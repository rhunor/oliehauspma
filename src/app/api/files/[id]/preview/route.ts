// src/app/api/files/[id]/preview/route.ts - FIXED FOR PUBLIC S3 ACCESS
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
  viewCount?: number;
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

    // 3. Get file details with populated user info
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

    // 5. Check if file can be previewed
    const mimeType = file.mimeType;
    const canPreview = 
      mimeType?.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType?.startsWith('text/');

    if (!canPreview) {
      return NextResponse.json({
        success: false,
        error: 'Preview not available for this file type',
        data: {
          _id: file._id.toString(),
          originalName: file.originalName,
          mimeType: file.mimeType,
          message: 'This file type cannot be previewed. Please download to view.'
        }
      });
    }

    // 6. FIXED: Since files are now public, redirect to direct S3 URL for preview
    try {
      console.log('Redirecting to public S3 URL for preview:', file.url);

      // Update view count (async, non-blocking)
      setImmediate(async () => {
        try {
          await db.collection('files').updateOne(
            { _id: fileObjectId },
            { 
              $inc: { viewCount: 1 },
              $set: { lastViewedAt: new Date() }
            }
          );
        } catch (error) {
          console.warn('Failed to update view count:', error);
        }
      });

      // FIXED: Redirect to the public S3 URL for inline preview
      return NextResponse.redirect(file.url, {
        status: 302,
        headers: {
          'Cache-Control': 'private, max-age=3600',
          'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
          'X-Content-Type-Options': 'nosniff'
        }
      });

    } catch (error) {
      console.error('Error processing preview:', error);
      return NextResponse.json(
        { error: 'Failed to process preview' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in file preview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}