// src/app/api/files/route.ts - Updated: Cloudinary storage, managers[] fix
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface FileDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  filename: string;
  originalName: string;
  cloudinaryId: string;
  url: string;
  size: number;
  mimeType: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: ObjectId;
  downloadCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'video/mp4', 'video/quicktime',
]);

async function validateFilePermission(
  userId: string,
  userRole: string,
  projectId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  if (userRole === 'super_admin') return true;

  const { db } = await connectToDatabase();
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    $or: [
      { client: new ObjectId(userId) },
      { managers: new ObjectId(userId) },
    ],
  });

  if (!project) return false;
  if (userRole === 'project_manager') return true;
  if (userRole === 'client' && action === 'read') return true;
  return false;
}

// GET /api/files
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const category = searchParams.get('category');
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const { db } = await connectToDatabase();
    const baseQuery: Record<string, unknown> = {};

    if (projectId) {
      const hasAccess = await validateFilePermission(session.user.id, session.user.role, projectId, 'read');
      if (!hasAccess) {
        return NextResponse.json({ success: false, error: 'Access denied to project files' }, { status: 403 });
      }
      baseQuery.projectId = new ObjectId(projectId);
    } else {
      const projectQuery =
        session.user.role === 'super_admin'
          ? {}
          : session.user.role === 'project_manager'
          ? { managers: new ObjectId(session.user.id) }
          : { client: new ObjectId(session.user.id) };

      const projects = await db.collection('projects').find(projectQuery, { projection: { _id: 1 } }).toArray();
      baseQuery.projectId = { $in: projects.map(p => p._id) };
    }

    if (category && category !== 'all') baseQuery.category = category;

    if (search) {
      baseQuery.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } },
      ];
    }

    const skip = (page - 1) * limit;
    const [files, total] = await Promise.all([
      db.collection('files')
        .aggregate([
          { $match: baseQuery },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'uploadedBy',
              foreignField: '_id',
              as: 'uploader',
            },
          },
          { $addFields: { uploader: { $arrayElemAt: ['$uploader', 0] } } },
        ])
        .toArray(),
      db.collection('files').countDocuments(baseQuery),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        files,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/files — upload to Cloudinary
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string;
    const description = (formData.get('description') as string) || '';
    const tags = (formData.get('tags') as string) || '';
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({ success: false, error: 'Valid project ID is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: `File type "${file.type}" is not allowed` }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    const canUpload = await validateFilePermission(session.user.id, session.user.role, projectId, 'write');
    if (!canUpload) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to upload files to this project' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Upload to Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToCloudinary({
      buffer,
      originalName: file.name,
      folder: `olivehaus/projects/${projectId}/files`,
      metadata: {
        uploadedBy: session.user.id,
        projectId,
        originalName: file.name,
      },
    });

    const fileData: FileDocument = {
      projectId: new ObjectId(projectId),
      filename: file.name,
      originalName: file.name,
      cloudinaryId: uploadResult.publicId,
      url: uploadResult.secureUrl,
      size: file.size,
      mimeType: file.type,
      category: getFileCategory(file.type),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      description,
      isPublic,
      uploadedBy: new ObjectId(session.user.id),
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('files').insertOne(fileData);

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: result.insertedId.toString(),
          projectId: fileData.projectId.toString(),
          filename: fileData.filename,
          originalName: fileData.originalName,
          url: fileData.url,
          size: fileData.size,
          mimeType: fileData.mimeType,
          category: fileData.category,
          tags: fileData.tags,
          description: fileData.description,
          isPublic: fileData.isPublic,
          uploadedBy: { _id: session.user.id, name: session.user.name, email: session.user.email },
          downloadCount: fileData.downloadCount,
          createdAt: fileData.createdAt.toISOString(),
          updatedAt: fileData.updatedAt.toISOString(),
        },
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
