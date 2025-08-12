// src/app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter, Collection } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  files: ObjectId[];
  client: ObjectId;
  manager: ObjectId;
  updatedAt: Date;
  title?: string;
}

interface FileDocument {
  _id?: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  path: string;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  category: string;
  tags: string[];
  description: string;
  isPublic: boolean;
  version: number;
  downloadCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  password?: string;
}

interface NotificationDocument {
  recipient: ObjectId;
  sender: ObjectId;
  type: string;
  title: string;
  message: string;
  data: {
    projectId?: ObjectId;
    fileId?: ObjectId;
    url?: string;
  };
  isRead: boolean;
  priority: string;
  category: string;
  createdAt: Date;
}

// Define aggregation result types
interface FileWithJoins extends Omit<FileDocument, 'uploadedBy' | 'projectId'> {
  uploadedBy: Omit<UserDocument, 'password'>;
  project: Pick<ProjectDocument, '_id' | 'title'>;
}

interface MatchQuery extends Filter<FileDocument> {
  projectId?: ObjectId | { $in: ObjectId[] };
  category?: string;
}

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to get file category based on MIME type
function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

// Helper function to validate file
function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'video/mp4', 'video/mpeg', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  return { valid: true };
}

// GET /api/files?projectId=xxx&category=image&page=1&limit=20
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    const { db } = await connectToDatabase();

    // Build query with proper typing
    const matchQuery: MatchQuery = {};
    
    if (projectId) {
      // Verify user has access to this project
      const project = await db.collection<ProjectDocument>('projects').findOne({
        _id: new ObjectId(projectId),
        $or: [
          { client: new ObjectId(session.user.id) },
          { manager: new ObjectId(session.user.id) },
          ...(session.user.role === 'super_admin' ? [{}] : [])
        ]
      });

      if (!project) {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }

      matchQuery.projectId = new ObjectId(projectId);
    } else if (session.user.role !== 'super_admin') {
      // Non-admin users can only see files from their projects
      const userProjects = await db.collection<ProjectDocument>('projects').find({
        $or: [
          { client: new ObjectId(session.user.id) },
          { manager: new ObjectId(session.user.id) }
        ]
      }).project({ _id: 1 }).toArray();

      matchQuery.projectId = { $in: userProjects.map(p => p._id) };
    }

    if (category) {
      matchQuery.category = category;
    }

    // Get files with pagination
    const files = await db.collection<FileDocument>('files')
      .aggregate<FileWithJoins>([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'uploaderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            uploadedBy: { $arrayElemAt: ['$uploaderData', 0] },
            project: { $arrayElemAt: ['$projectData', 0] }
          }
        },
        { $unset: ['uploaderData', 'projectData'] },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    // Get total count
    const totalCount = await db.collection<FileDocument>('files').countDocuments(matchQuery);

    return NextResponse.json({
      success: true,
      data: files,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/files
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify user has access to this project
    const project = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) },
        ...(session.user.role === 'super_admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', projectId);
    const filePath = path.join(uploadDir, uniqueFilename);

    // Create upload directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true });

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get file category
    const category = getFileCategory(file.type);

    // Create file record in database
    const newFile: FileDocument = {
      filename: uniqueFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      url: `/uploads/${projectId}/${uniqueFilename}`,
      path: filePath,
      projectId: new ObjectId(projectId),
      uploadedBy: new ObjectId(session.user.id),
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      description: description || '',
      isPublic,
      version: 1,
      downloadCount: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<FileDocument>('files').insertOne(newFile);

    // Add file to project (now with typed collection)
    const projects: Collection<ProjectDocument> = db.collection<ProjectDocument>('projects');
    await projects.updateOne(
      { _id: new ObjectId(projectId) },
      { 
        $push: { files: result.insertedId },
        $set: { updatedAt: new Date() }
      }
    );

    // Create notification for project team (except uploader)
    const projectTeam = [project.client, project.manager].filter(
      userId => userId && userId.toString() !== session.user.id
    );

    const notifications: NotificationDocument[] = projectTeam.map(userId => ({
      recipient: userId,
      sender: new ObjectId(session.user.id),
      type: 'file_uploaded',
      title: 'New File Uploaded',
      message: `${session.user.name} uploaded a new file: ${file.name}`,
      data: {
        projectId: new ObjectId(projectId),
        fileId: result.insertedId,
        url: `/uploads/${projectId}/${uniqueFilename}`
      },
      isRead: false,
      priority: 'medium',
      category: 'info',
      createdAt: new Date()
    }));

    if (notifications.length > 0) {
      await db.collection<NotificationDocument>('notifications').insertMany(notifications);
    }

    // Get the created file with populated data
    const createdFile = await db.collection<FileDocument>('files')
      .aggregate<FileWithJoins>([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'uploaderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            uploadedBy: { $arrayElemAt: ['$uploaderData', 0] }
          }
        },
        { $unset: ['uploaderData'] }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: createdFile[0],
      message: 'File uploaded successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}