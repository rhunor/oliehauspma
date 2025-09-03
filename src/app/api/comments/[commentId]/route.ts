// src/app/api/comments/[commentId]/route.ts - Update and Delete Comments
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, UpdateFilter } from 'mongodb';

// Import our enhanced comment types
import type { TaskComment } from '@/lib/types/comments';

// Interface for update comment request
interface UpdateCommentRequest {
  content?: string;
}

// Interface for route params
interface CommentUpdateParams {
  params: Promise<{
    commentId: string;
  }>;
}

// Enhanced comment document for MongoDB
interface CommentDocument {
  _id?: ObjectId;
  taskId: ObjectId;
  content: string;
  authorId: ObjectId;
  isInternal: boolean;
  mentions?: ObjectId[];
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  parentCommentId?: ObjectId;
  edited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// PUT /api/comments/[commentId] - Update comment
export async function PUT(
  request: NextRequest,
  { params }: CommentUpdateParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { commentId } = await params;
    
    if (!ObjectId.isValid(commentId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid comment ID' 
      }, { status: 400 });
    }

    const body: UpdateCommentRequest = await request.json();
    
    if (!body.content || body.content.trim().length < 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment content is required' 
      }, { status: 400 });
    }

    if (body.content.length > 1000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment content must be less than 1000 characters' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get comment and verify ownership
    const comment = await db.collection<CommentDocument>('comments').findOne({
      _id: new ObjectId(commentId)
    });

    if (!comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Only allow author or super_admin to edit
    if (!comment.authorId.equals(userId) && session.user.role !== 'super_admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Permission denied - You can only edit your own comments' 
      }, { status: 403 });
    }

    // Update comment
    const updateDoc: UpdateFilter<CommentDocument> = {
      $set: {
        content: body.content.trim(),
        edited: true,
        editedAt: new Date(),
        updatedAt: new Date()
      }
    };

    const result = await db.collection<CommentDocument>('comments').updateOne(
      { _id: new ObjectId(commentId) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Get updated comment with author details
    const updatedComment = await db.collection<CommentDocument>('comments').findOne({
      _id: new ObjectId(commentId)
    });

    const author = await db.collection('users').findOne(
      { _id: updatedComment!.authorId },
      { projection: { name: 1, role: 1, avatar: 1 } }
    );

    const responseComment: TaskComment = {
      _id: updatedComment!._id!.toString(),
      taskId: updatedComment!.taskId.toString(),
      content: updatedComment!.content,
      authorId: updatedComment!.authorId.toString(),
      authorName: author?.name || 'Unknown User',
      authorRole: (author?.role as 'client' | 'project_manager' | 'super_admin') || 'client',
      isInternal: updatedComment!.isInternal,
      mentions: updatedComment!.mentions?.map(m => m.toString()) || [],
      attachments: updatedComment!.attachments || [],
      parentCommentId: updatedComment!.parentCommentId?.toString(),
      edited: updatedComment!.edited,
      editedAt: updatedComment!.editedAt?.toISOString(),
      createdAt: updatedComment!.createdAt.toISOString(),
      updatedAt: updatedComment!.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: {
        comment: responseComment,
        message: 'Comment updated successfully'
      }
    });

  } catch (error: unknown) {
    console.error('Error updating comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// DELETE /api/comments/[commentId] - Delete comment
export async function DELETE(
  request: NextRequest,
  { params }: CommentUpdateParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { commentId } = await params;
    
    if (!ObjectId.isValid(commentId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid comment ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get comment and verify ownership
    const comment = await db.collection<CommentDocument>('comments').findOne({
      _id: new ObjectId(commentId)
    });

    if (!comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Only allow author or super_admin to delete
    if (!comment.authorId.equals(userId) && session.user.role !== 'super_admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Permission denied - You can only delete your own comments' 
      }, { status: 403 });
    }

    // Check if comment has replies
    const hasReplies = await db.collection('comments').countDocuments({
      parentCommentId: new ObjectId(commentId)
    });

    if (hasReplies > 0) {
      // Don't actually delete, just mark as deleted
      await db.collection<CommentDocument>('comments').updateOne(
        { _id: new ObjectId(commentId) },
        { 
          $set: { 
            content: '[Comment deleted]',
            edited: true,
            editedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Delete comment completely
      await db.collection('comments').deleteOne({
        _id: new ObjectId(commentId)
      });
    }

    // Update task comment count
    await db.collection('tasks').updateOne(
      { _id: comment.taskId },
      { 
        $inc: { commentCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'Comment deleted successfully'
      }
    });

  } catch (error: unknown) {
    console.error('Error deleting comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}