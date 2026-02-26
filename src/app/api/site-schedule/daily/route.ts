// src/app/api/site-schedule/daily/route.ts - UPDATED: Added 'to-do' status support
import { NextRequest, NextResponse } from "next/server";
import { auth, authOptions } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import DailyProgress, { 
  IDailyProgressDocument, 
  IDailyActivity, 
  IDailyProgress 
} from "@/models/DailyProgress";
import { Types } from "mongoose";

// For populated documents
interface IPopulatedDailyActivity extends Omit<IDailyActivity, 'contractor' | 'supervisor'> {
  contractor: { name: string } | string;
  supervisor: { name: string } | string;
}

interface IPopulatedDailyProgress extends Omit<IDailyProgress, 'activities'> {
  activities: IPopulatedDailyActivity[];
}

// GET daily progress for a specific date
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToMongoose();
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const date = searchParams.get("date");
    
    if (!projectId || !date) {
      return NextResponse.json(
        { error: "Project ID and date are required" },
        { status: 400 }
      );
    }

    const dailyProgress = await DailyProgress.findOne({
      project: projectId,
      date: new Date(date)
    }).populate('activities.contractor', 'name')
      .populate('activities.supervisor', 'name') as IPopulatedDailyProgress | null;

    return NextResponse.json({
      success: true,
      data: dailyProgress || {
        activities: [],
        date: date,
        summary: {
          totalActivities: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          delayed: 0,
          onHold: 0,
          toDo: 0 // ADDED: Include to-do count
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });

  } catch (error) {
    console.error("Error fetching daily progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// POST new daily activity - UPDATED: Support 'to-do' status
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can add activities (allow legacy 'admin')
    if (!['project_manager', 'super_admin', 'admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can add activities" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const body = await request.json();
    const { projectId, date, activity } = body;

    // Validate required fields
    if (!projectId || !date || !activity) {
      return NextResponse.json(
        { error: "Project ID, date, and activity data are required" },
        { status: 400 }
      );
    }

    if (!activity.title || !activity.contractor) {
      return NextResponse.json(
        { error: "Activity title and contractor are required" },
        { status: 400 }
      );
    }

    // Validate required startDate and endDate
    if (!activity.startDate || !activity.endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Validate that endDate is after startDate
    const startDateTime = new Date(activity.startDate);
    const endDateTime = new Date(activity.endDate);

    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Find or create daily progress
    let dailyProgress = await DailyProgress.findOne({
      project: projectId,
      date: new Date(date)
    }) as IDailyProgressDocument | null;

    if (!dailyProgress) {
      dailyProgress = new DailyProgress({
        project: projectId,
        date: new Date(date),
        activities: [],
        summary: {
          totalActivities: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          delayed: 0,
          onHold: 0,
          toDo: 0 // ADDED
        }
      }) as IDailyProgressDocument;
    }

    // Create new activity
    const newActivity: IDailyActivity = {
      title: activity.title,
      description: activity.description || '',
      contractor: activity.contractor,
      supervisor: activity.supervisor,
      startDate: new Date(activity.startDate),
      endDate: new Date(activity.endDate),
      // UPDATED: Default to 'to-do' if not specified
      status: activity.status || 'to-do',
      priority: activity.priority || 'medium',
      category: activity.category || 'other',
      progress: activity.progress || 0,
      comments: activity.comments,
      clientComments: [],
      images: activity.images || [],
      incidentReport: activity.incidentReport,
      plannedDate: activity.plannedDate ? new Date(activity.plannedDate) : new Date(date),
      actualDate: activity.actualDate ? new Date(activity.actualDate) : undefined,
      createdBy: new Types.ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add the new activity
    dailyProgress.activities.push(newActivity);

    // Update summary statistics - UPDATED: Include to-do count
    const activities = dailyProgress.activities;
    dailyProgress.summary.totalActivities = activities.length;
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;
    dailyProgress.summary.onHold = activities.filter((a: IDailyActivity) => a.status === 'on_hold').length;
    dailyProgress.summary.toDo = activities.filter((a: IDailyActivity) => a.status === 'to-do').length; // ADDED
    dailyProgress.updatedAt = new Date();

    // Save with error handling
    try {
      await dailyProgress.save();
    } catch (saveError) {
      console.error("Error saving daily progress:", saveError);
      return NextResponse.json(
        { 
          error: "Failed to save activity",
          details: saveError instanceof Error ? saveError.message : "Unknown error"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dailyProgress,
      message: "Activity added successfully"
    });

  } catch (error) {
    console.error("Error adding daily activity:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// PUT update existing activity - UPDATED: Support 'to-do' status
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can update activities (allow legacy 'admin')
    if (!['project_manager', 'super_admin', 'admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can update activities" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const body = await request.json();
    const { projectId, date, activityId, updates } = body;

    if (!projectId || !date || !activityId || !updates) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate date fields if being updated
    if (updates.startDate && updates.endDate) {
      const startDateTime = new Date(updates.startDate);
      const endDateTime = new Date(updates.endDate);

      if (endDateTime <= startDateTime) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }
    }

    const dailyProgress = await DailyProgress.findOne({
      project: projectId,
      date: new Date(date)
    }) as IDailyProgressDocument | null;

    if (!dailyProgress) {
      return NextResponse.json(
        { error: "Daily progress not found" },
        { status: 404 }
      );
    }

    // Find and update the activity
    const activities = dailyProgress.activities;
    const activityIndex = activities.findIndex(
      (a: IDailyActivity) => a._id?.toString() === activityId
    );

    if (activityIndex === -1) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Type-safe field updates
    const activity = activities[activityIndex];
    
    // Update string fields
    if (updates.title !== undefined) activity.title = updates.title;
    if (updates.description !== undefined) activity.description = updates.description;
    if (updates.contractor !== undefined) activity.contractor = updates.contractor;
    if (updates.supervisor !== undefined) activity.supervisor = updates.supervisor;
    if (updates.comments !== undefined) activity.comments = updates.comments;
    if (updates.incidentReport !== undefined) activity.incidentReport = updates.incidentReport;
    
    // Update date fields
    if (updates.startDate !== undefined) {
      activity.startDate = new Date(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      activity.endDate = new Date(updates.endDate);
    }
    if (updates.plannedDate !== undefined) {
      activity.plannedDate = updates.plannedDate ? new Date(updates.plannedDate) : undefined;
    }
    if (updates.actualDate !== undefined) {
      activity.actualDate = updates.actualDate ? new Date(updates.actualDate) : undefined;
    }
    
    // Update enum fields - UPDATED: Support 'to-do' status
    if (updates.status !== undefined) activity.status = updates.status;
    if (updates.priority !== undefined) activity.priority = updates.priority;
    if (updates.category !== undefined) activity.category = updates.category;
    
    // Update number field
    if (updates.progress !== undefined) activity.progress = updates.progress;
    
    // Update array fields
    if (updates.images !== undefined) {
      activity.images = Array.isArray(updates.images) ? updates.images : [];
    }

    // Update metadata
    activity.updatedAt = new Date();
    activity.updatedBy = new Types.ObjectId(session.user.id);
    dailyProgress.updatedAt = new Date();

    // Recalculate summary - UPDATED: Include to-do count
    dailyProgress.summary.totalActivities = activities.length;
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;
    dailyProgress.summary.onHold = activities.filter((a: IDailyActivity) => a.status === 'on_hold').length;
    dailyProgress.summary.toDo = activities.filter((a: IDailyActivity) => a.status === 'to-do').length; // ADDED

    // Save changes
    try {
      await dailyProgress.save();
    } catch (saveError) {
      console.error("Error saving updates:", saveError);
      return NextResponse.json(
        { 
          error: "Failed to update activity",
          details: saveError instanceof Error ? saveError.message : "Unknown error"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dailyProgress,
      message: "Activity updated successfully"
    });

  } catch (error) {
    console.error("Error updating daily activity:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}