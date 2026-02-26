// src/app/api/projects/[id]/activities/[activityId]/route.ts
// API endpoints for individual activity CRUD operations
// FIXED: Proper Next.js 15 inline params typing

import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToMongoose } from '@/lib/db';
import Project from '@/models/Project';
import { Types } from 'mongoose';
import type {
  UpdateActivityRequest,
  ActivityApiResponse,
  ActivityApiError,
  Activity
} from '@/types/activity';

// Session interface
interface SessionUser {
  id: string;
  role: 'super_admin' | 'project_manager' | 'client';
  name?: string;
  email?: string;
}

interface AuthSession {
  user: SessionUser;
}

// Helper: Validate authentication
async function validateAuth(
  allowedRoles: string[]
): Promise<{ error: NextResponse<ActivityApiError> | null; session: AuthSession | null }> {
  const session = await auth() as AuthSession | null;
  
  if (!session) {
    return {
      error: NextResponse.json<ActivityApiError>(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      ),
      session: null
    };
  }

  if (!allowedRoles.includes(session.user.role)) {
    return {
      error: NextResponse.json<ActivityApiError>(
        { success: false, error: `Access denied - ${session.user.role} not allowed` },
        { status: 403 }
      ),
      session: null
    };
  }

  return { error: null, session };
}

// Helper: Transform MongoDB activity to API response format
function transformActivity(
  projectId: string,
  phaseId: string,
  activity: Record<string, unknown>
): Activity {
  return {
    _id: activity._id?.toString() ?? '',
    title: activity.title as string,
    description: activity.description as string | undefined,
    status: activity.status as Activity['status'],
    priority: activity.priority as Activity['priority'],
    category: activity.category as Activity['category'],
    assignedTo: Array.isArray(activity.assignedTo)
      ? (activity.assignedTo as unknown[]).map(id => (id as Types.ObjectId).toString())
      : undefined,
    startDate: activity.startDate instanceof Date
      ? activity.startDate.toISOString()
      : new Date().toISOString(),
    endDate: activity.endDate instanceof Date
      ? activity.endDate.toISOString()
      : new Date().toISOString(),
    progress: typeof activity.progress === 'number' ? activity.progress : 0,
    comments: Array.isArray(activity.comments)
      ? (activity.comments as Record<string, unknown>[]).map(comment => ({
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
        }))
      : [],
    images: Array.isArray(activity.images) ? (activity.images as string[]) : [],
    contractor: activity.contractor as string | undefined,
    supervisor: activity.supervisor as string | undefined,
    estimatedDuration: activity.estimatedDuration as string | undefined,
    actualDuration: activity.actualDuration as string | undefined,
    resources: Array.isArray(activity.resources) ? (activity.resources as string[]) : [],
    dependencies: Array.isArray(activity.dependencies)
      ? (activity.dependencies as unknown[]).map(id => (id as Types.ObjectId).toString())
      : [],
    createdBy: activity.createdBy?.toString(),
    createdAt: activity.createdAt instanceof Date
      ? activity.createdAt.toISOString()
      : new Date().toISOString(),
    updatedAt: activity.updatedAt instanceof Date
      ? activity.updatedAt.toISOString()
      : new Date().toISOString()
  };
}

// GET - Retrieve a specific activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
): Promise<NextResponse<ActivityApiResponse | ActivityApiError>> {
  try {
    const { error: authError, session } = await validateAuth([
      'super_admin',
      'project_manager',
      'client'
    ]);
    if (authError || !session) {
      return authError as NextResponse<ActivityApiError>;
    }

    await connectToMongoose();

    // FIXED: Await params promise with explicit typing to resolve unknown inference
    const resolvedParams: { id: string; activityId: string } = await params;
    const { id: projectId, activityId } = resolvedParams;

    // Validate ObjectIds
    if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid project or activity ID' },
        { status: 400 }
      );
    }

    // Find project and activity
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

    // Find the activity in phases
    let foundActivity: Record<string, unknown> | null = null;
    let foundPhaseId = '';

    if (project.siteSchedule && project.siteSchedule.phases) {
      for (const phase of project.siteSchedule.phases) {
        if (phase.activities) {
          const activity = phase.activities.find(
            (a: Record<string, unknown>) => a._id?.toString() === activityId
          );
          if (activity) {
            foundActivity = activity as Record<string, unknown>;
            foundPhaseId = phase._id.toString();
            break;
          }
        }
      }
    }

    if (!foundActivity) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    const activityData = transformActivity(projectId, foundPhaseId, foundActivity);

    return NextResponse.json<ActivityApiResponse>({
      success: true,
      data: activityData
    });

  } catch (error) {
    console.error('Error fetching activity:', error);
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

// PUT - Update an activity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
): Promise<NextResponse<ActivityApiResponse | ActivityApiError>> {
  try {
    const { error: authError, session } = await validateAuth([
      'super_admin',
      'project_manager'
    ]);
    if (authError || !session) {
      return authError as NextResponse<ActivityApiError>;
    }

    await connectToMongoose();

    // FIXED: Await params promise with explicit typing to resolve unknown inference
    const resolvedParams: { id: string; activityId: string } = await params;
    const { id: projectId, activityId } = resolvedParams;

    if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid project or activity ID' },
        { status: 400 }
      );
    }

    let body: UpdateActivityRequest;
    try {
      body = await request.json() as UpdateActivityRequest;
    } catch {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate date fields if provided
    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      if (endDate <= startDate) {
        return NextResponse.json<ActivityApiError>(
          { success: false, error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      session.user.role === 'super_admin' ||
      (project.managers && project.managers.some(
        (m: Types.ObjectId) => m.toString() === session.user.id
      ));

    if (!isAuthorized) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Not authorized to edit this project' },
        { status: 403 }
      );
    }

    // Find and update the activity
    let updated = false;
    let updatedActivity: Record<string, unknown> | null = null;
    let phaseId = '';

    if (project.siteSchedule && project.siteSchedule.phases) {
      for (const phase of project.siteSchedule.phases) {
        if (phase.activities) {
          const activityIndex = phase.activities.findIndex(
            (a: Record<string, unknown>) => a._id?.toString() === activityId
          );

          if (activityIndex !== -1) {
            const activity = phase.activities[activityIndex];

            // Update fields
            if (body.title !== undefined) activity.title = body.title;
            if (body.description !== undefined) activity.description = body.description;
            if (body.status !== undefined) activity.status = body.status;
            if (body.priority !== undefined) activity.priority = body.priority;
            if (body.category !== undefined) activity.category = body.category;
            if (body.progress !== undefined) activity.progress = body.progress;
            if (body.contractor !== undefined) activity.contractor = body.contractor;
            if (body.supervisor !== undefined) activity.supervisor = body.supervisor;
            if (body.estimatedDuration !== undefined) activity.estimatedDuration = body.estimatedDuration;
            if (body.actualDuration !== undefined) activity.actualDuration = body.actualDuration;

            if (body.startDate !== undefined) {
              activity.startDate = new Date(body.startDate);
            }
            if (body.endDate !== undefined) {
              activity.endDate = new Date(body.endDate);
            }

            if (body.assignedTo !== undefined) {
              activity.assignedTo = body.assignedTo.map((id: string) => new Types.ObjectId(id));
            }

            if (body.resources !== undefined) {
              activity.resources = body.resources;
            }

            if (body.dependencies !== undefined) {
              activity.dependencies = body.dependencies.map((id: string) => new Types.ObjectId(id));
            }

            activity.updatedBy = new Types.ObjectId(session.user.id);
            activity.updatedAt = new Date();

            updatedActivity = activity as Record<string, unknown>;
            phaseId = phase._id.toString();
            updated = true;
            break;
          }
        }
      }
    }

    if (!updated || !updatedActivity) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Save the project (triggers middleware to update progress)
    await project.save();

    const activityData = transformActivity(projectId, phaseId, updatedActivity);

    return NextResponse.json<ActivityApiResponse>({
      success: true,
      data: activityData,
      message: 'Activity updated successfully'
    });

  } catch (error) {
    console.error('Error updating activity:', error);
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

// DELETE - Remove an activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
): Promise<NextResponse<ActivityApiResponse | ActivityApiError>> {
  try {
    const { error: authError, session } = await validateAuth([
      'super_admin',
      'project_manager'
    ]);
    if (authError || !session) {
      return authError as NextResponse<ActivityApiError>;
    }

    await connectToMongoose();

    // FIXED: Await params promise with explicit typing to resolve unknown inference
    const resolvedParams: { id: string; activityId: string } = await params;
    const { id: projectId, activityId } = resolvedParams;

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

    const isAuthorized =
      session.user.role === 'super_admin' ||
      (project.managers && project.managers.some(
        (m: Types.ObjectId) => m.toString() === session.user.id
      ));

    if (!isAuthorized) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Not authorized to delete activities' },
        { status: 403 }
      );
    }

    let deleted = false;
    let deletedActivity: Record<string, unknown> | null = null;

    if (project.siteSchedule && project.siteSchedule.phases) {
      for (const phase of project.siteSchedule.phases) {
        if (phase.activities) {
          const activityIndex = phase.activities.findIndex(
            (a: Record<string, unknown>) => a._id?.toString() === activityId
          );

          if (activityIndex !== -1) {
            deletedActivity = phase.activities[activityIndex] as Record<string, unknown>;
            phase.activities.splice(activityIndex, 1);
            deleted = true;
            break;
          }
        }
      }
    }

    if (!deleted || !deletedActivity) {
      return NextResponse.json<ActivityApiError>(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    await project.save();

    return NextResponse.json<ActivityApiResponse>({
      success: true,
      data: transformActivity(projectId, '', deletedActivity),
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting activity:', error);
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