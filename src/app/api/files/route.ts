// src/app/api/files/route.ts - COMPLETE WITH DASHBOARD COMPATIBILITY FIXES
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { 
  validateFilePermission, 
  getUserAccessibleFiles, 
  validateFile, 
  getFileCategory 
} from '@/lib/file-permissions';

// Define proper TypeScript interfaces
interface FileDocument {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  path: string;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  tags: string[];
  description: string;
  isPublic: boolean;
  version: number;
  parentFileId?: ObjectId;
  downloadCount: number;
  lastAccessedAt?: Date;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    compression?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
}

interface CreateFileData {
  projectId: string;
  description?: string;
  tags?: string;
  isPublic?: boolean;
}

// GET /api/files - Get files with role-based access control
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    const recent = searchParams.get('recent') === 'true';

    // Get files user has access to
    const allFiles = await getUserAccessibleFiles(
      session.user.id, 
      session.user.role, 
      projectId || undefined
    );

    // Apply additional filters
    let filteredFiles = allFiles;

    if (category && category !== 'all') {
      filteredFiles = allFiles.filter((file: typeof allFiles[0]) => file.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredFiles = allFiles.filter((file: typeof allFiles[0]) =>
        file.originalName.toLowerCase().includes(searchLower) ||
        file.description.toLowerCase().includes(searchLower) ||
        file.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort by recent if requested
    if (recent) {
      filteredFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedFiles = filteredFiles.slice(startIndex, startIndex + limit);

    // Calculate stats
   const stats = {
  total: filteredFiles.length,
  totalSize: filteredFiles.reduce((sum: number, file: typeof allFiles[0]) => sum + file.size, 0),
  byCategory: filteredFiles.reduce((acc: Record<string, number>, file: typeof allFiles[0]) => {
    const category = file.category ?? 'other'; // ✅ Default to 'other' if undefined
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
};

    // DASHBOARD COMPATIBILITY FIX: Return response in expected format
    return NextResponse.json({
      success: true,
      data: {
        data: paginatedFiles, // Nested data structure for dashboard compatibility
        pagination: {
          page,
          limit,
          total: filteredFiles.length,
          pages: Math.ceil(filteredFiles.length / limit),
          hasNext: page < Math.ceil(filteredFiles.length / limit),
          hasPrev: page > 1
        }
      },
      // Also include the original structure for backward compatibility
      files: paginatedFiles,
      stats
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

// POST /api/files - Upload files with security validation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;
    const isPublic = formData.get('isPublic') === 'true';

    // Validate required fields
    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: 'No file provided' 
      }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ 
        success: false,
        error: 'Project ID is required' 
      }, { status: 400 });
    }

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid project ID' 
      }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false,
        error: validation.error 
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

    // Verify project exists and user has access
    const project = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) },
        ...(session.user.role === 'super_admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return NextResponse.json({ 
        success: false,
        error: 'Project not found or access denied' 
      }, { status: 404 });
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

    // Parse tags
    const parsedTags = tags ? 
      tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0) : 
      [];

    // Create file record in database with proper Date objects
    const newFile: Omit<FileDocument, '_id'> = {
      filename: uniqueFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      url: `/uploads/${projectId}/${uniqueFilename}`,
      path: filePath,
      projectId: new ObjectId(projectId),
      uploadedBy: new ObjectId(session.user.id),
      category,
      tags: parsedTags,
      description: description || '',
      isPublic: isPublic || false,
      version: 1,
      downloadCount: 0,
      createdAt: new Date(), // Ensure this is a Date object
      updatedAt: new Date()  // Ensure this is a Date object
    };

    const result = await db.collection('files').insertOne(newFile);

    // Get the created file with populated data
    const createdFile = await db.collection('files')
      .aggregate([
        { $match: { _id: result.insertedId } },
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
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'uploaderData',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] },
            uploadedBy: { $arrayElemAt: ['$uploaderData', 0] }
          }
        },
        { $unset: ['projectData', 'uploaderData'] }
      ])
      .toArray();

    if (createdFile.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Failed to retrieve created file' 
      }, { status: 500 });
    }

    const fileData = createdFile[0];

    // Convert to client-compatible format with safe date conversion
    const clientFile = {
      _id: fileData._id.toString(),
      filename: fileData.filename,
      originalName: fileData.originalName,
      size: fileData.size,
      mimeType: fileData.mimeType,
      url: fileData.url,
      category: fileData.category,
      tags: fileData.tags,
      description: fileData.description,
      isPublic: fileData.isPublic,
      uploadedBy: {
        _id: fileData.uploadedBy._id.toString(),
        name: fileData.uploadedBy.name,
        email: fileData.uploadedBy.email
      },
      project: {
        _id: fileData.project._id.toString(),
        title: fileData.project.title
      },
      // SAFE DATE CONVERSION: Handle both Date objects and strings
      createdAt: fileData.createdAt instanceof Date 
        ? fileData.createdAt.toISOString() 
        : new Date(fileData.createdAt).toISOString(),
      updatedAt: fileData.updatedAt instanceof Date 
        ? fileData.updatedAt.toISOString() 
        : new Date(fileData.updatedAt).toISOString(),
      downloadCount: fileData.downloadCount
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

// DELETE /api/files/[id] - Delete file with permission check
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId || !ObjectId.isValid(fileId)) {
      return NextResponse.json({ 
        success: false,
        error: 'Valid file ID is required' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Get file details
    const file = await db.collection('files').findOne({ _id: new ObjectId(fileId) });

    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: 'File not found' 
      }, { status: 404 });
    }

    // Check delete permission
    const canDelete = await validateFilePermission(
      session.user.id,
      session.user.role,
      file.projectId.toString(),
      'delete'
    );

    // Also allow file uploader to delete their own files
    const isUploader = file.uploadedBy.equals(new ObjectId(session.user.id));

    if (!canDelete && !isUploader) {
      return NextResponse.json({ 
        success: false,
        error: 'You do not have permission to delete this file' 
      }, { status: 403 });
    }

    // Delete file from database
    await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });

    // TODO: Delete physical file from disk
    // const fs = require('fs').promises;
    // try {
    //   await fs.unlink(file.path);
    // } catch (fsError) {
    //   console.warn('Failed to delete physical file:', fsError);
    // }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 });
  }
}