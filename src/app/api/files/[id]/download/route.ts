// src/app/api/files/[id]/download/route.ts - Secure File Download
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { getSignedDownloadUrl } from '@/lib/s3';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    // Check access permission
    const hasAccess = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && fileDoc.project.manager.equals(new ObjectId(session.user.id))) ||
      (session.user.role === 'client' && fileDoc.project.client.equals(new ObjectId(session.user.id))) ||
      fileDoc.isPublic;

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Generate signed download URL
    const downloadUrl = await getSignedDownloadUrl(fileDoc.s3Key, 3600); // 1 hour expiry

    // Update download count and last accessed time
    await db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      {
        $inc: { downloadCount: 1 },
        $set: { lastAccessedAt: new Date() }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl,
        filename: fileDoc.originalName,
        size: fileDoc.size,
        mimeType: fileDoc.mimeType
      }
    });

  } catch (error: unknown) {
    console.error('Error generating download URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

