// src/app/api/files/[id]/route.ts - FIXED File Management with backward compatibility
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
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
    const session = await auth();
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
      (session.user.role === 'project_manager' && fileDoc.project && fileDoc.project.manager.equals(new ObjectId(session.user.id))) ||
      fileDoc.uploadedBy.equals(new ObjectId(session.user.id));

    if (!canDelete) {
      return NextResponse.json({
        success: false,
        error: 'You do not have permission to delete this file'
      }, { status: 403 });
    }

    // FIXED: Handle both new AWS files and old legacy files
    let s3DeletionError = null;
    
    // Try to delete from S3 if it's an S3 file
    if (fileDoc.s3Key) {
      // New format: has s3Key field
      try {
        console.log('Deleting S3 file with key:', fileDoc.s3Key);
        await deleteFileFromS3(fileDoc.s3Key);
        console.log('Successfully deleted from S3');
      } catch (error) {
        console.warn('Failed to delete from S3:', error);
        s3DeletionError = error;
        // Don't fail the entire operation - continue to delete from database
      }
    } else if (fileDoc.url && (fileDoc.url.includes('s3.amazonaws.com') || fileDoc.url.includes('cloudfront.net'))) {
      // Old format: extract S3 key from URL
      try {
        const urlParts = fileDoc.url.split('/');
        const bucketAndRegionIndex = urlParts.findIndex((part: string) => part.includes('s3.amazonaws.com'));
        if (bucketAndRegionIndex > 0) {
          const s3Key = urlParts.slice(bucketAndRegionIndex + 1).join('/');
          console.log('Extracted S3 key from URL:', s3Key);
          await deleteFileFromS3(s3Key);
          console.log('Successfully deleted from S3 using extracted key');
        }
      } catch (error) {
        console.warn('Failed to delete from S3 using extracted key:', error);
        s3DeletionError = error;
        // Don't fail the entire operation - continue to delete from database
      }
    } else {
      console.log('File is not stored in S3, skipping S3 deletion');
    }

    // Delete file record from database (always do this)
    const deleteResult = await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'File record not found in database'
      }, { status: 404 });
    }

    // Return success, but warn if S3 deletion failed
    const response = {
      success: true,
      message: 'File deleted successfully from database'
    };

    if (s3DeletionError) {
      response.message += ', but S3 deletion may have failed. The file record has been removed from the database.';
      console.warn('S3 deletion warning included in response');
    }

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('Error deleting file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}