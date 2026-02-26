// src/app/api/site-schedule/daily/[activityId]/comments/route.ts
// FIXED: Proper handling of ObjectId creation

import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToMongoose } from '@/lib/db';
import DailyProgress, { IDailyProgressDocument, IClientComment } from '@/models/DailyProgress';
import { Types } from 'mongoose';

// Session and auth interfaces
interface SessionUser {
  id: string;
  role: 'super_admin' | 'project_manager' | 'client';
  name?: string;
  email?: string;
}

interface AuthSession {
  user: SessionUser;
}

// Request body interface for creating comments
interface CreateCommentRequest {
  content: string;
  attachments?: string[]; // S3 URLs for any attached files
}

// Response interface for comments
interface CommentResponse {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}

// Validate authentication with role-based access
async function validateAuth(allowedRoles: string[]): Promise<{
  error: NextResponse | null;
  session: AuthSession | null;
}> {
  const session = await auth() as AuthSession | null;
  
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      ),
      session: null
    };
  }

  if (!allowedRoles.includes(session.user.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: `Access denied - ${session.user.role} role not allowed` },
        { status: 403 }
      ),
      session: null
    };
  }

  return { error: null, session };
}

// Helper to find activity in daily progress
async function findActivityInDailyProgress(activityId: string): Promise<{
  dailyProgress: IDailyProgressDocument | null;
  activityIndex: number;
}> {
  if (!Types.ObjectId.isValid(activityId)) {
    return { dailyProgress: null, activityIndex: -1 };
  }

  const dailyProgress = await DailyProgress.findOne({
    'activities._id': new Types.ObjectId(activityId)
  }) as IDailyProgressDocument | null;

  if (!dailyProgress) {
    return { dailyProgress: null, activityIndex: -1 };
  }

  const activityIndex = dailyProgress.activities.findIndex(
    activity => activity._id?.toString() === activityId
  );

  return { dailyProgress, activityIndex };
}

// GET - Fetch all comments for an activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const { error: authError } = await validateAuth(['super_admin', 'project_manager', 'client']);
    if (authError) return authError;

    await connectToMongoose();

    const { activityId } = await params;

    // Find the activity
    const { dailyProgress, activityIndex } = await findActivityInDailyProgress(activityId);

    if (!dailyProgress || activityIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    const activity = dailyProgress.activities[activityIndex];

    // Transform comments for response
    const comments: CommentResponse[] = (activity.clientComments || []).map((comment: IClientComment) => ({
      _id: comment._id?.toString() || '',
      userId: comment.userId.toString(),
      userName: comment.userName,
      userRole: comment.userRole,
      content: comment.content,
      attachments: comment.attachments || [],
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt?.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        activityId: activity._id?.toString(),
        activityTitle: activity.title,
        comments,
        totalComments: comments.length
      }
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Add a new comment to an activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const { error: authError, session } = await validateAuth(['super_admin', 'project_manager', 'client']);
    if (authError || !session) return authError!;

    await connectToMongoose();

    const { activityId } = await params;

    // Parse request body
    let body: CreateCommentRequest;
    try {
      body = await request.json() as CreateCommentRequest;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate comment content
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (body.content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Comment must be less than 1000 characters' },
        { status: 400 }
      );
    }

    // Find the activity
    const { dailyProgress, activityIndex } = await findActivityInDailyProgress(activityId);

    if (!dailyProgress || activityIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    const activity = dailyProgress.activities[activityIndex];

    // FIXED: Create ObjectId first, then use it (guarantees it's defined)
    const commentId = new Types.ObjectId();
    const userId = new Types.ObjectId(session.user.id);
    const now = new Date();

    // Create new comment with guaranteed defined _id
    const newComment: IClientComment = {
      _id: commentId,
      userId: userId,
      userName: session.user.name || 'Unknown User',
      userRole: session.user.role,
      content: body.content.trim(),
      attachments: body.attachments || [],
      createdAt: now,
      updatedAt: now
    };

    // Initialize clientComments array if it doesn't exist
    if (!activity.clientComments) {
      activity.clientComments = [];
    }

    // Add comment to activity
    activity.clientComments.push(newComment);
    activity.updatedAt = new Date();

    // Mark the nested field as modified for Mongoose
    dailyProgress.markModified(`activities.${activityIndex}.clientComments`);
    dailyProgress.updatedAt = new Date();

    // Save changes
    await dailyProgress.save();

    // Transform comment for response (now commentId is guaranteed to be defined)
    const commentResponse: CommentResponse = {
      _id: commentId.toString(),
      userId: userId.toString(),
      userName: newComment.userName,
      userRole: newComment.userRole,
      content: newComment.content,
      attachments: newComment.attachments || [],
      createdAt: newComment.createdAt.toISOString(),
      updatedAt: newComment.updatedAt?.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: commentResponse,
      message: 'Comment added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove a comment (only comment author or admin can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const { error: authError, session } = await validateAuth(['super_admin', 'project_manager', 'client']);
    if (authError || !session) return authError!;

    await connectToMongoose();

    const { activityId } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    // Find the activity
    const { dailyProgress, activityIndex } = await findActivityInDailyProgress(activityId);

    if (!dailyProgress || activityIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    const activity = dailyProgress.activities[activityIndex];

    if (!activity.clientComments || activity.clientComments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Find the comment
    const commentIndex = activity.clientComments.findIndex(
      comment => comment._id?.toString() === commentId
    );

    if (commentIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = activity.clientComments[commentIndex];

    // Authorization check: Only the comment author or admin can delete
    const isAuthor = comment.userId.toString() === session.user.id;
    const isAdmin = session.user.role === 'super_admin' || session.user.role === 'project_manager';

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

    // Remove the comment
    activity.clientComments.splice(commentIndex, 1);
    activity.updatedAt = new Date();

    // Mark as modified
    dailyProgress.markModified(`activities.${activityIndex}.clientComments`);
    dailyProgress.updatedAt = new Date();

    // Save changes
    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}