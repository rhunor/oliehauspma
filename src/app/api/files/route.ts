// src/app/api/files/route.ts - Updated with Cloud Storage and Security
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { uploadFileToS3, generateFileKey, validateFileType, validateFileSize } from '@/lib/s3';

interface FileDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  filename: string;
  originalName: string;
  s3Key: string;
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

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
}

function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

async function validateFilePermission(
  userId: string,
  userRole: string,
  projectId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  const { db } = await connectToDatabase();

  if (userRole === 'super_admin') return true;

  const project = await db.collection<ProjectDocument>('projects').findOne({
    _id: new ObjectId(projectId),
    $or: [
      { client: new ObjectId(userId) },
      { manager: new ObjectId(userId) }
    ]
  });

  if (!project) return false;

  // Project managers can do all actions, clients can only read
  if (userRole === 'project_manager') return true;
  if (userRole === 'client' && action === 'read') return true;

  return false;
}

// GET /api/files - Retrieve files with role-based access control
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const category = searchParams.get('category');
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const { db } = await connectToDatabase();

    // Build base query for user access
    const baseQuery: Record<string, unknown> = {};

    if (projectId) {
      // Check permission for specific project
      const hasAccess = await validateFilePermission(
        session.user.id,
        session.user.role,
        projectId,
        'read'
      );

      if (!hasAccess) {
        return NextResponse.json({
          success: false,
          error: 'Access denied to project files'
        }, { status: 403 });
      }

      baseQuery.projectId = new ObjectId(projectId);
    } else {
      // Get all accessible projects for user
      const projectQuery = session.user.role === 'super_admin' 
        ? {} 
        : session.user.role === 'project_manager'
        ? { manager: new ObjectId(session.user.id) }
        : { client: new ObjectId(session.user.id) };

      const projects = await db.collection('projects').find(projectQuery, { projection: { _id: 1 } }).toArray();
      const projectIds = projects.map(p => p._id);
      
      baseQuery.projectId = { $in: projectIds };
    }

    // Add additional filters
    if (category && category !== 'all') {
      baseQuery.category = category;
    }

    if (search) {
      baseQuery.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    // Get files with pagination
    const files = await db.collection('files')
      .aggregate([
        { $match: baseQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'uploadedBy',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            uploadedBy: { $arrayElemAt: ['$uploadedBy', 0] },
            project: { $arrayElemAt: ['$project', 0] }
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    // Get total count for pagination
    const total = await db.collection('files').countDocuments(baseQuery);

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
          hasPrev: page > 1
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 });
  }
}

// POST /api/files - Upload files to cloud storage
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const description = formData.get('description') as string || '';
    const tags = formData.get('tags') as string || '';
    const isPublic = formData.get('isPublic') === 'true';

    // Validate required fields
    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: 'No file provided' 
      }, { status: 400 });
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({ 
        success: false,
        error: 'Valid project ID is required' 
      }, { status: 400 });
    }

    // Validate file
    if (!validateFileType(file)) {
      return NextResponse.json({ 
        success: false,
        error: 'File type not allowed' 
      }, { status: 400 });
    }

    if (!validateFileSize(file, 50)) {
      return NextResponse.json({ 
        success: false,
        error: 'File size exceeds 50MB limit' 
      }, { status: 400 });
    }

    // Check upload permission
    const canUpload = await validateFilePermission(
      session.user.id,
      session.user.role,
      projectId,
      'write'
    );

    if (!canUpload) {
      return NextResponse.json({ 
        success: false,
        error: 'You do not have permission to upload files to this project' 
      }, { status: 403 });
    }

    const { db } = await connectToDatabase();

    // Verify project exists
    const project = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json({ 
        success: false,
        error: 'Project not found' 
      }, { status: 404 });
    }

    // Generate S3 key and upload file
    const s3Key = generateFileKey(session.user.id, projectId, file.name);
    
    const uploadResult = await uploadFileToS3({
      file,
      key: s3Key,
      contentType: file.type,
      metadata: {
        projectId,
        uploadedBy: session.user.id,
        description: description || ''
      }
    });

    // Save file metadata to database
    const fileData: FileDocument = {
      projectId: new ObjectId(projectId),
      filename: s3Key.split('/').pop() || file.name,
      originalName: file.name,
      s3Key: uploadResult.key,
      url: uploadResult.url,
      size: uploadResult.size,
      mimeType: uploadResult.contentType,
      category: getFileCategory(uploadResult.contentType),
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [],
      description,
      isPublic,
      uploadedBy: new ObjectId(session.user.id),
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('files').insertOne(fileData);

    // Return client-safe data
    const clientFile = {
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
      uploadedBy: {
        _id: session.user.id,
        name: session.user.name,
        email: session.user.email
      },
      downloadCount: fileData.downloadCount,
      createdAt: fileData.createdAt.toISOString(),
      updatedAt: fileData.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: clientFile,
      message: 'File uploaded successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 });
  }
}