// src/app/api/site-schedule/activity/[id]/route.ts
// UPDATED: Added 'to-do' status support

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import DailyProgress, { IDailyActivity, IDailyProgressDocument } from "@/models/DailyProgress";
import { Types, HydratedDocument } from "mongoose";

interface PopulatedProject {
  _id: Types.ObjectId;
  title: string;
}

type PopulatedDailyProgressDocument = HydratedDocument<IDailyProgressDocument> & {
  project: PopulatedProject;
};

// UPDATED: Response interface with 'to-do' status
interface ActivityResponse {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold'; // UPDATED: Added 'to-do'
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  comments?: string;
  images?: string[];
  plannedDate?: string;
  actualDate?: string;
  progress?: number;
  projectId: string;
  projectTitle: string;
  date: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SessionUser {
  id: string;
  role: string;
  name?: string;
  email?: string;
}

interface AuthSession {
  user: SessionUser;
}

// UPDATED: Type-safe field updater with 'to-do' status support
function updateActivityField(
  activity: IDailyActivity,
  field: keyof IDailyActivity,
  value: unknown
): void {
  switch (field) {
    case 'title':
      if (typeof value === 'string') {
        activity.title = value;
      }
      break;
    case 'description':
    case 'comments':
    case 'incidentReport':
      if (typeof value === 'string' || value === undefined) {
        activity[field] = value;
      }
      break;
    case 'contractor':
      if (typeof value === 'string') {
        activity.contractor = value;
      }
      break;
    case 'supervisor':
      if (typeof value === 'string' || value === undefined) {
        activity.supervisor = value;
      }
      break;
    case 'startDate':
    case 'endDate':
      if (typeof value === 'string' && value) {
        activity[field] = new Date(value);
      } else if (value instanceof Date) {
        activity[field] = value;
      }
      break;
    case 'status':
      // UPDATED: Added 'to-do' to valid status values
      if (value === 'to-do' || value === 'pending' || value === 'in_progress' || 
          value === 'completed' || value === 'delayed' || value === 'on_hold') {
        activity.status = value;
      }
      break;
    case 'priority':
      if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') {
        activity.priority = value;
      }
      break;
    case 'category':
      if (value === 'structural' || value === 'electrical' || value === 'plumbing' || 
          value === 'finishing' || value === 'other') {
        activity.category = value;
      } else if (value === undefined) {
        activity.category = undefined;
      }
      break;
    case 'progress':
      if (typeof value === 'number' || value === undefined) {
        activity.progress = value;
      }
      break;
    case 'plannedDate':
    case 'actualDate':
      if (typeof value === 'string' && value) {
        activity[field] = new Date(value);
      } else if (value === null || value === '' || value === undefined) {
        activity[field] = undefined;
      }
      break;
    case 'images':
      if (Array.isArray(value)) {
        activity.images = value;
      } else if (value === undefined) {
        activity.images = undefined;
      }
      break;
    case 'createdBy':
    case 'updatedBy':
      if (value && typeof value === 'string' && Types.ObjectId.isValid(value)) {
        activity[field] = new Types.ObjectId(value);
      } else if (value instanceof Types.ObjectId) {
        activity[field] = value;
      }
      break;
    case 'createdAt':
    case 'updatedAt':
      if (value instanceof Date) {
        activity[field] = value;
      } else if (typeof value === 'string') {
        activity[field] = new Date(value);
      }
      break;
  }
}

async function handleApiError(
  operation: () => Promise<NextResponse>,
  context: string
): Promise<NextResponse> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context}:`, error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    );
  }
}

async function validateAuth(requiredRoles: string[] = ['project_manager', 'super_admin']): Promise<{
  error: NextResponse | null;
  session: AuthSession | null;
}> {
  const session = await auth() as AuthSession | null;
  
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null
    };
  }

  if (!requiredRoles.includes(session.user.role)) {
    return {
      error: NextResponse.json(
        { error: `Forbidden - Role '${session.user.role}' not allowed` }, 
        { status: 403 }
      ),
      session: null
    };
  }

  return { error: null, session };
}

function transformActivityToResponse(
  activity: IDailyActivity,
  dailyProgress: PopulatedDailyProgressDocument
): ActivityResponse {
  return {
    _id: activity._id?.toString() || '',
    title: activity.title,
    description: activity.description,
    contractor: activity.contractor,
    supervisor: activity.supervisor,
    startDate: activity.startDate ? activity.startDate.toISOString() : new Date().toISOString(),
    endDate: activity.endDate ? activity.endDate.toISOString() : new Date().toISOString(),
    status: activity.status,
    priority: activity.priority,
    category: activity.category,
    comments: activity.comments,
    images: activity.images || [],
    plannedDate: activity.plannedDate?.toISOString(),
    actualDate: activity.actualDate?.toISOString(),
    progress: activity.progress,
    projectId: dailyProgress.project._id.toString(),
    projectTitle: dailyProgress.project.title,
    date: dailyProgress.date.toISOString(),
    createdBy: activity.createdBy?.toString(),
    updatedBy: activity.updatedBy?.toString(),
    createdAt: activity.createdAt?.toISOString(),
    updatedAt: activity.updatedAt?.toISOString()
  };
}

function isPopulatedDailyProgress(
  doc: HydratedDocument<IDailyProgressDocument>
): doc is PopulatedDailyProgressDocument {
  return doc.project && typeof doc.project === 'object' && 'title' in doc.project;
}

// GET specific activity by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiError(async () => {
    const { error: authError } = await validateAuth(['project_manager', 'super_admin', 'client']);
    if (authError) return authError;

    await connectToMongoose();
    
    const { id: activityId } = await params;

    if (!activityId || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
    }

    const dailyProgress = await DailyProgress.findOne({
      'activities._id': new Types.ObjectId(activityId)
    }).populate('project', 'title');

    if (!dailyProgress) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!isPopulatedDailyProgress(dailyProgress)) {
      return NextResponse.json({ error: "Project data not properly loaded" }, { status: 500 });
    }

    const activity = dailyProgress.activities.find(
      (a: IDailyActivity) => a._id?.toString() === activityId
    );

    if (!activity) {
      return NextResponse.json({ error: "Activity not found in daily progress" }, { status: 404 });
    }

    const activityData = transformActivityToResponse(activity, dailyProgress);

    return NextResponse.json({
      success: true,
      data: activityData
    });
  }, 'GET /api/site-schedule/activity/[id]');
}

// PUT update specific activity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiError(async () => {
    const { error: authError, session } = await validateAuth(['project_manager', 'super_admin', 'admin']);
    if (authError || !session) return authError!;

    await connectToMongoose();
    
    const { id: activityId } = await params;

    if (!activityId || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (body.startDate && body.endDate) {
      const startDateTime = new Date(body.startDate as string);
      const endDateTime = new Date(body.endDate as string);

      if (endDateTime <= startDateTime) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }
    }

    const dailyProgress = await DailyProgress.findOne({
      'activities._id': new Types.ObjectId(activityId)
    });

    if (!dailyProgress) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const activityIndex = dailyProgress.activities.findIndex(
      (a: IDailyActivity) => a._id?.toString() === activityId
    );

    if (activityIndex === -1) {
      return NextResponse.json({ error: "Activity not found in daily progress" }, { status: 404 });
    }

    const currentActivity = dailyProgress.activities[activityIndex];
    
    const oldStatus = currentActivity.status;
    const activityTitle = currentActivity.title;
    const projectId = dailyProgress.project.toString();
    
    const allowedFields: (keyof IDailyActivity)[] = [
      'title', 'description', 'contractor', 'supervisor', 
      'startDate', 'endDate',
      'status', 'priority', 'category',
      'plannedDate', 'actualDate',
      'comments', 'images', 'incidentReport', 'progress'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateActivityField(currentActivity, field, body[field]);
      }
    });

    currentActivity.updatedBy = new Types.ObjectId(session.user.id);
    currentActivity.updatedAt = new Date();

    dailyProgress.markModified(`activities.${activityIndex}`);
    await dailyProgress.save();

    if (currentActivity.status === 'completed' && oldStatus !== 'completed') {
      const { updateProjectProgress, notifyClientOfTaskCompletion, notifyClientOfProgressUpdate } = 
        await import('@/lib/projectUtils');

      try {
        const newProgress = await updateProjectProgress(projectId);
        await notifyClientOfTaskCompletion(projectId, activityTitle, session.user.id);
        await notifyClientOfProgressUpdate(projectId, newProgress, session.user.id);
      } catch (notifError) {
        console.error('Error in auto-triggers:', notifError);
      }
    }

    const populatedDailyProgress = await DailyProgress.populate(dailyProgress, {
      path: 'project',
      select: 'title'
    });

    if (!isPopulatedDailyProgress(populatedDailyProgress)) {
      return NextResponse.json({ 
        success: true,
        data: null,
        message: "Activity updated successfully"
      });
    }

    const updatedActivityData = transformActivityToResponse(
      currentActivity, 
      populatedDailyProgress
    );

    return NextResponse.json({
      success: true,
      data: updatedActivityData,
      message: "Activity updated successfully"
    });
  }, 'PUT /api/site-schedule/activity/[id]');
}

// DELETE specific activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiError(async () => {
    const { error: authError, session } = await validateAuth(['project_manager', 'super_admin', 'admin']);
    if (authError || !session) return authError!;

    await connectToMongoose();
    
    const { id: activityId } = await params;

    if (!activityId || !Types.ObjectId.isValid(activityId)) {
      return NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
    }

    const dailyProgress = await DailyProgress.findOne({
      'activities._id': new Types.ObjectId(activityId)
    });

    if (!dailyProgress) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    dailyProgress.activities = dailyProgress.activities.filter(
      (a: IDailyActivity) => a._id?.toString() !== activityId
    );

    dailyProgress.markModified('activities');
    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      data: null,
      message: "Activity deleted successfully"
    });
  }, 'DELETE /api/site-schedule/activity/[id]');
}