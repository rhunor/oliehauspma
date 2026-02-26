// src/app/api/site-schedule/link-activity/route.ts
// API to link DailyProgress activities to Project.siteSchedule activities

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToMongoose } from '@/lib/db';
import { connectToDatabase } from '@/lib/db';
import DailyProgress, { IDailyProgressDocument } from '@/models/DailyProgress';
import { Types } from 'mongoose';
import { ObjectId } from 'mongodb';

// ==================== TYPES ====================

interface SessionUser {
  id: string;
  role: 'super_admin' | 'project_manager' | 'client';
  name?: string;
  email?: string;
}

interface AuthSession {
  user: SessionUser;
}

interface LinkActivityRequest {
  dailyProgressId: string;
  dailyActivityId: string;
  linkedProjectId: string;
  linkedPhaseId: string;
  linkedActivityId: string;
  syncEnabled?: boolean;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  siteSchedule?: {
    phases: Array<{
      _id: ObjectId;
      name: string;
      activities: Array<{
        _id: ObjectId;
        title: string;
        status: string;
        progress: number;
        plannedStartDate: Date;
        plannedEndDate: Date;
      }>;
    }>;
  };
}

// ==================== HELPER FUNCTIONS ====================

async function validateAuth(allowedRoles: string[]): Promise<{
  error: NextResponse | null;
  session: AuthSession | null;
}> {
  const session = await auth() as AuthSession | null;
  
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
      session: null
    };
  }

  if (!allowedRoles.includes(session.user.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      ),
      session: null
    };
  }

  return { error: null, session };
}

// ==================== POST - Link Activity ====================

export async function POST(request: NextRequest) {
  try {
    const { error: authError, session } = await validateAuth(['project_manager', 'super_admin']);
    if (authError || !session) return authError!;

    await connectToMongoose();
    const { db } = await connectToDatabase();

    const body: LinkActivityRequest = await request.json();
    const {
      dailyProgressId,
      dailyActivityId,
      linkedProjectId,
      linkedPhaseId,
      linkedActivityId,
      syncEnabled = false
    } = body;

    // Validate required fields
    if (!dailyProgressId || !dailyActivityId || !linkedProjectId || !linkedPhaseId || !linkedActivityId) {
      return NextResponse.json(
        { success: false, error: 'All linking fields are required' },
        { status: 400 }
      );
    }

    // Validate ObjectIds
    if (!Types.ObjectId.isValid(dailyProgressId) ||
        !Types.ObjectId.isValid(dailyActivityId) ||
        !Types.ObjectId.isValid(linkedProjectId) ||
        !Types.ObjectId.isValid(linkedPhaseId) ||
        !Types.ObjectId.isValid(linkedActivityId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ObjectId format' },
        { status: 400 }
      );
    }

    // Verify project activity exists
    const project = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(linkedProjectId),
      'siteSchedule.phases._id': new ObjectId(linkedPhaseId),
      'siteSchedule.phases.activities._id': new ObjectId(linkedActivityId)
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project activity not found' },
        { status: 404 }
      );
    }

    // Find daily progress document
    const dailyProgress = await DailyProgress.findById(dailyProgressId) as IDailyProgressDocument;

    if (!dailyProgress) {
      return NextResponse.json(
        { success: false, error: 'Daily progress not found' },
        { status: 404 }
      );
    }

    // Find the activity in the daily progress
    const activityIndex = dailyProgress.activities.findIndex(
      a => a._id?.toString() === dailyActivityId
    );

    if (activityIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Daily activity not found' },
        { status: 404 }
      );
    }

    // Update the activity with linking information
    const activity = dailyProgress.activities[activityIndex];
    activity.linkedProjectId = new Types.ObjectId(linkedProjectId);
    activity.linkedPhaseId = new Types.ObjectId(linkedPhaseId);
    activity.linkedActivityId = new Types.ObjectId(linkedActivityId);
    activity.syncEnabled = syncEnabled;
    activity.updatedBy = new Types.ObjectId(session.user.id);
    activity.updatedAt = new Date();

    dailyProgress.markModified('activities');
    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      message: 'Activity linked successfully',
      data: {
        dailyActivityId: activity._id?.toString(),
        linkedProjectId: linkedProjectId,
        linkedPhaseId: linkedPhaseId,
        linkedActivityId: linkedActivityId,
        syncEnabled: syncEnabled
      }
    });

  } catch (error) {
    console.error('Error linking activity:', error);
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

// ==================== DELETE - Unlink Activity ====================

export async function DELETE(request: NextRequest) {
  try {
    const { error: authError, session } = await validateAuth(['project_manager', 'super_admin']);
    if (authError || !session) return authError!;

    await connectToMongoose();

    const { searchParams } = new URL(request.url);
    const dailyProgressId = searchParams.get('dailyProgressId');
    const dailyActivityId = searchParams.get('dailyActivityId');

    if (!dailyProgressId || !dailyActivityId) {
      return NextResponse.json(
        { success: false, error: 'Daily progress ID and activity ID are required' },
        { status: 400 }
      );
    }

    if (!Types.ObjectId.isValid(dailyProgressId) || !Types.ObjectId.isValid(dailyActivityId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ObjectId format' },
        { status: 400 }
      );
    }

    // Find daily progress document
    const dailyProgress = await DailyProgress.findById(dailyProgressId) as IDailyProgressDocument;

    if (!dailyProgress) {
      return NextResponse.json(
        { success: false, error: 'Daily progress not found' },
        { status: 404 }
      );
    }

    // Find the activity
    const activityIndex = dailyProgress.activities.findIndex(
      a => a._id?.toString() === dailyActivityId
    );

    if (activityIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Daily activity not found' },
        { status: 404 }
      );
    }

    // Remove linking information
    const activity = dailyProgress.activities[activityIndex];
    activity.linkedProjectId = undefined;
    activity.linkedPhaseId = undefined;
    activity.linkedActivityId = undefined;
    activity.syncEnabled = false;
    activity.updatedBy = new Types.ObjectId(session.user.id);
    activity.updatedAt = new Date();

    dailyProgress.markModified('activities');
    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      message: 'Activity unlinked successfully'
    });

  } catch (error) {
    console.error('Error unlinking activity:', error);
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

// ==================== GET - Get Linked Activities ====================

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await validateAuth(['project_manager', 'super_admin', 'client']);
    if (authError) return authError;

    await connectToMongoose();

    const { searchParams } = new URL(request.url);
    const linkedActivityId = searchParams.get('linkedActivityId');
    const projectId = searchParams.get('projectId');

    // Get all daily progress entries linked to a specific project activity
    if (linkedActivityId) {
      if (!Types.ObjectId.isValid(linkedActivityId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid activity ID' },
          { status: 400 }
        );
      }

      const dailyProgressEntries = await DailyProgress.find({
        'activities.linkedActivityId': new Types.ObjectId(linkedActivityId)
      }).sort({ date: -1 }).limit(30);

      const linkedActivities = dailyProgressEntries.flatMap(dp =>
        dp.activities
          .filter(a => a.linkedActivityId?.toString() === linkedActivityId)
          .map(a => ({
            _id: a._id?.toString(),
            date: dp.date,
            title: a.title,
            status: a.status,
            progress: a.progress,
            contractor: a.contractor,
            comments: a.comments,
            images: a.images || [],
            clientComments: a.clientComments || []
          }))
      );

      return NextResponse.json({
        success: true,
        data: linkedActivities
      });
    }

    // Get all linked activities for a project
    if (projectId) {
      if (!Types.ObjectId.isValid(projectId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid project ID' },
          { status: 400 }
        );
      }

      const dailyProgressEntries = await DailyProgress.find({
        project: new Types.ObjectId(projectId),
        'activities.linkedActivityId': { $exists: true, $ne: null }
      }).sort({ date: -1 }).limit(50);

      const linkedActivities = dailyProgressEntries.flatMap(dp =>
        dp.activities
          .filter(a => a.linkedActivityId)
          .map(a => ({
            _id: a._id?.toString(),
            date: dp.date,
            title: a.title,
            status: a.status,
            progress: a.progress,
            linkedActivityId: a.linkedActivityId?.toString(),
            linkedPhaseId: a.linkedPhaseId?.toString(),
            syncEnabled: a.syncEnabled
          }))
      );

      return NextResponse.json({
        success: true,
        data: linkedActivities
      });
    }

    return NextResponse.json(
      { success: false, error: 'Either linkedActivityId or projectId is required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error getting linked activities:', error);
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