// src/app/api/files/[id]/download/route.ts - FIXED FOR PUBLIC S3 ACCESS
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface FileDocument {
  _id: ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  size: number;
  projectId?: ObjectId;
  uploadedBy: ObjectId;
  isPublic?: boolean;
  downloadCount?: number;
  createdAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  client: ObjectId;
  manager: ObjectId;
  title: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 2. Validate id parameter
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid file ID' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);
    const fileObjectId = new ObjectId(id);

    // 3. Get file details
    const file = await db.collection('files').findOne({
      _id: fileObjectId
    }) as FileDocument | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // 4. Check user permissions
    let hasAccess = false;

    if (session.user.role === 'super_admin') {
      hasAccess = true;
    } else if (file.isPublic) {
      hasAccess = true;
    } else if (file.uploadedBy.equals(userId)) {
      hasAccess = true;
    } else if (file.projectId) {
      // Check project access
      const project = await db.collection('projects').findOne({
        _id: file.projectId
      }) as ProjectDocument | null;

      if (project) {
        if (session.user.role === 'project_manager' && project.manager.equals(userId)) {
          hasAccess = true;
        } else if (session.user.role === 'client' && project.client.equals(userId)) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 5. FIXED: Since files are now public, redirect to direct S3 URL
    // This is much more efficient than proxying the file
    try {
      console.log('Redirecting to public S3 URL:', file.url);

      // Update download count (async, non-blocking)
      setImmediate(async () => {
        try {
          await db.collection('files').updateOne(
            { _id: fileObjectId },
            { 
              $inc: { downloadCount: 1 },
              $set: { 
                lastDownloadedAt: new Date(),
                lastDownloadedBy: userId
              }
            }
          );
        } catch (error) {
          console.warn('Failed to update download count:', error);
        }
      });

      // FIXED: Redirect to the public S3 URL with proper headers
      return NextResponse.redirect(file.url, {
        status: 302,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`
        }
      });

    } catch (error) {
      console.error('Error processing download:', error);
      return NextResponse.json(
        { error: 'Failed to process download' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in file download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}