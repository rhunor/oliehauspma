// ========================================
// src/app/api/files/[id]/preview/route.ts - FIXED WITH AWAITED PARAMS
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface FileDocument {
  _id: ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  size: number;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  isPublic: boolean;
  viewCount?: number;
  createdAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  client: ObjectId;
  manager: ObjectId;
  title: string;
}

interface FilePreviewParams {
  id: string;
}

// ========================================
// src/app/api/files/[id]/preview/route.ts - FIXED FOR PROPER FILE PREVIEW
// ========================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
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

    // 4. Check user permissions (same as download)
    let hasAccess = false;

    if (session.user.role === 'super_admin') {
      hasAccess = true;
    } else if (file.isPublic) {
      hasAccess = true;
    } else if (file.uploadedBy.equals(userId)) {
      hasAccess = true;
    } else if (file.projectId) {
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

    try {
      console.log('Fetching file for preview from URL:', file.url);
      
      // 6. FIXED: Fetch file for preview
      const fileResponse = await fetch(file.url, {
        method: 'GET',
        cache: 'no-store'
      });
      
      if (!fileResponse.ok) {
        console.error('File preview fetch failed:', fileResponse.status);
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }

      // 7. FIXED: Get blob for preview
      const fileBlob = await fileResponse.blob();
      
      // 8. FIXED: Set correct headers for inline preview
      const headers = new Headers({
        'Content-Type': mimeType,
        'Content-Length': fileBlob.size.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      });

      // 9. Update view count (async, non-blocking)
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

      // 10. FIXED: Return the blob for preview
      return new NextResponse(fileBlob, {
        status: 200,
        headers
      });

    } catch (fetchError) {
      console.error('Error fetching file for preview:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load file content for preview' },
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
