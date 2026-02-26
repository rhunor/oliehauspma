// src/app/api/projects/[id]/activities/[activityId]/comments/route.ts
// API endpoint for adding comments to activities
// FIXED: Proper Next.js 15 params typing with Promise

import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToMongoose } from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';
import { Types } from 'mongoose';
import type {
  AddCommentRequest,
  ActivityComment,
  ActivityApiError
} from '@/types/activity';

interface SessionUser {
  id: string;
  role: 'super_admin' | 'project_manager' | 'client';
  name?: string;
  email?: string;
}

interface AuthSession {
  user: SessionUser;
}

// FIXED: params is a Promise in Next.js 15
interface RouteParams {
  params: Promise<{
    id: string;
    activityId: string;
  }>;
}

interface CommentApiResponse {
  success: true;
  // POST may return either the created ActivityComment OR the full activity comments payload
  data: ActivityComment | {
    projectId: string;
    activityId: string;
    activityTitle: string;
    comments: ActivityComment[];
    totalComments: number;
  };
  message?: string;
}

interface CommentsListResponse {
  success: true;
  data: ActivityComment[];
}

type CommentApiResult = CommentApiResponse | ActivityApiError;
type CommentsListResult = CommentsListResponse | ActivityApiError;

// POST - Add a comment to an activity
export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<CommentApiResult>> {
  try {
    const session = await auth() as AuthSession | null;

    if (!session) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    await connectToMongoose();

    // FIXED: Await params promise
    const { id: projectId, activityId } = await context.params;

    if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid project or activity ID' },
        { status: 400 }
      );
    }

    let body: AddCommentRequest;
    try {
      body = await request.json() as AddCommentRequest;
    } catch {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!body.content || body.content.trim() === '') {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check access rights
    const hasAccess =
      session.user.role === 'super_admin' ||
      project.client.toString() === session.user.id ||
      (project.managers && project.managers.some(
        (m: Types.ObjectId) => m.toString() === session.user.id
      ));

    if (!hasAccess) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    // Get user details
    const user = await User.findById(session.user.id).select('name email role');

    if (!user) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the activity and add comment
    let commentAdded = false;
    let newComment: Record<string, unknown> | null = null;

    if (project.siteSchedule && project.siteSchedule.phases) {
      for (const phase of project.siteSchedule.phases) {
        if (phase.activities) {
          const activity = phase.activities.find(
            (a: Record<string, unknown>) => a._id?.toString() === activityId
          );

          if (activity) {
            if (!Array.isArray(activity.comments)) {
              activity.comments = [];
            }

            const comment = {
              _id: new Types.ObjectId(),
              author: new Types.ObjectId(session.user.id),
              authorName: user.name,
              authorRole: user.role,
              content: body.content.trim(),
              attachments: body.attachments || [],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            activity.comments.push(comment);
            newComment = comment;
            commentAdded = true;
            break;
          }
        }
      }
    }

    if (!commentAdded || !newComment) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    await project.save();

    const commentResponse: ActivityComment = {
      _id: newComment._id?.toString() ?? '',
      author: {
        _id: session.user.id,
        name: user.name,
        role: user.role,
        email: user.email
      },
      content: newComment.content as string,
      attachments: Array.isArray(newComment.attachments) 
        ? (newComment.attachments as string[]) 
        : [],
      createdAt: newComment.createdAt instanceof Date
        ? newComment.createdAt.toISOString()
        : new Date().toISOString(),
      updatedAt: newComment.updatedAt instanceof Date
        ? newComment.updatedAt.toISOString()
        : undefined
    };

    return NextResponse.json<CommentApiResponse>({
      success: true,
      data: commentResponse,
      message: 'Comment added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json<ActivityApiError>(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Retrieve all comments for an activity
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<CommentsListResult>> {
  try {
    const session = await auth() as AuthSession | null;

    if (!session) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    await connectToMongoose();

    // FIXED: Await params promise
    const { id: projectId, activityId } = await context.params;

    if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid project or activity ID' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const hasAccess =
      session.user.role === 'super_admin' ||
      project.client.toString() === session.user.id ||
      (project.managers && project.managers.some(
        (m: Types.ObjectId) => m.toString() === session.user.id
      ));

    if (!hasAccess) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    let comments: ActivityComment[] = [];

    if (project.siteSchedule && project.siteSchedule.phases) {
      for (const phase of project.siteSchedule.phases) {
        if (phase.activities) {
          const activity = phase.activities.find(
            (a: Record<string, unknown>) => a._id?.toString() === activityId
          );

          if (activity && Array.isArray(activity.comments)) {
            comments = (activity.comments as Record<string, unknown>[]).map(comment => ({
              _id: comment._id?.toString() ?? '',
              author: {
                _id: comment.author?.toString() ?? '',
                name: comment.authorName as string,
                role: comment.authorRole as string
              },
              content: comment.content as string,
              attachments: Array.isArray(comment.attachments)
                ? (comment.attachments as string[])
                : [],
              createdAt: comment.createdAt instanceof Date
                ? comment.createdAt.toISOString()
                : new Date().toISOString(),
              updatedAt: comment.updatedAt instanceof Date
                ? comment.updatedAt.toISOString()
                : undefined
            }));
            break;
          }
        }
      }
    }

    return NextResponse.json<CommentsListResponse>({
      success: true,
      data: comments
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json<ActivityApiError>(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}