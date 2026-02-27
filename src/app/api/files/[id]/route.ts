// src/app/api/files/[id]/route.ts - Updated: Cloudinary delete, managers[] fix
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { deleteFromCloudinary, extractCloudinaryPublicId } from '@/lib/cloudinary';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const fileId = params.id;

    if (!ObjectId.isValid(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const files = await db
      .collection('files')
      .aggregate([
        { $match: { _id: new ObjectId(fileId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project',
          },
        },
        { $addFields: { project: { $arrayElemAt: ['$project', 0] } } },
      ])
      .toArray();

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const fileDoc = files[0];

    // Check delete permission
    const isManager =
      Array.isArray(fileDoc.project?.managers) &&
      fileDoc.project.managers.some((m: ObjectId) => m.equals(new ObjectId(session.user.id)));

    const canDelete =
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && isManager) ||
      fileDoc.uploadedBy.equals(new ObjectId(session.user.id));

    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this file' },
        { status: 403 }
      );
    }

    // Delete from Cloudinary (try cloudinaryId first, fall back to extracting from URL)
    let cloudinaryPublicId: string | null = fileDoc.cloudinaryId || null;

    if (!cloudinaryPublicId && fileDoc.url) {
      // Handle Cloudinary URLs
      if (fileDoc.url.includes('res.cloudinary.com')) {
        cloudinaryPublicId = extractCloudinaryPublicId(fileDoc.url);
      }
    }

    if (cloudinaryPublicId) {
      try {
        const resourceType = fileDoc.mimeType?.startsWith('video/') ? 'video' : 'image';
        await deleteFromCloudinary(cloudinaryPublicId, resourceType);
      } catch (err) {
        console.warn('Cloudinary deletion warning (proceeding with DB delete):', err);
      }
    }

    // Always delete from database
    const deleteResult = await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'File record not found in database' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
