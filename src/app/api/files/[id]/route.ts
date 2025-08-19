// src/app/api/files/[id]/route.ts - File Management (DELETE with cloud cleanup)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { deleteFileFromS3 } from '@/lib/s3';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const fileId = params.id;

    if (!ObjectId.isValid(fileId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file ID'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Get file with project information
    const file = await db.collection('files')
      .aggregate([
        { $match: { _id: new ObjectId(fileId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$project', 0] }
          }
        }
      ])
      .toArray();

    if (file.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'File not found'
      }, { status: 404 });
    }

    const fileDoc = file[0];

    // Check delete permission (only uploader, project manager, or admin can delete)
    const canDelete = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && fileDoc.project.manager.equals(new ObjectId(session.user.id))) ||
      fileDoc.uploadedBy.equals(new ObjectId(session.user.id));

    if (!canDelete) {
      return NextResponse.json({
        success: false,
        error: 'You do not have permission to delete this file'
      }, { status: 403 });
    }

    // Delete file from S3
    await deleteFileFromS3(fileDoc.s3Key);

    // Delete file record from database
    await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });

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