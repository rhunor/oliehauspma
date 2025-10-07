// src/app/api/site-schedule/daily/route.ts - FIXED: Better error handling and validation
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);
    
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
          delayed: 0
        }
      }
    });

  } catch (error) {
    console.error("Error fetching daily progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST new daily activity - FIXED: Better validation and error handling
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can add activities
    if (session.user.role !== 'project_manager' && session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: "Only project managers and admins can add activities" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const body = await request.json();
    const { projectId, date, activity } = body;

    // FIXED: Better validation
    if (!projectId || !date || !activity) {
      return NextResponse.json(
        { error: "Project ID, date, and activity data are required" },
        { status: 400 }
      );
    }

    // FIXED: Validate required activity fields
    if (!activity.title || !activity.contractor) {
      return NextResponse.json(
        { error: "Activity title and contractor are required" },
        { status: 400 }
      );
    }

    // FIXED: Validate ObjectId
    if (!Types.ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    // Find or create daily progress document
    let dailyProgress = await DailyProgress.findOne({
      project: projectId,
      date: new Date(date)
    }) as IDailyProgressDocument | null;

    if (!dailyProgress) {
      // FIXED: Create new document with proper structure
      dailyProgress = new DailyProgress({
        project: new Types.ObjectId(projectId),
        date: new Date(date),
        activities: [],
        summary: {
          totalActivities: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          delayed: 0
        },
        approved: false,
        createdBy: new Types.ObjectId(session.user.id),
        createdAt: new Date(),
        updatedAt: new Date()
      }) as IDailyProgressDocument;
    }

    // FIXED: Prepare the new activity with proper types
    const newActivity: IDailyActivity = {
      _id: new Types.ObjectId(), // Generate new ID
      title: activity.title,
      description: activity.description || '',
      contractor: activity.contractor,
      supervisor: activity.supervisor,
      plannedDate: activity.plannedDate ? new Date(activity.plannedDate) : new Date(date),
      actualDate: activity.actualDate ? new Date(activity.actualDate) : undefined,
      status: activity.status || 'pending',
      priority: activity.priority || 'medium',
      category: activity.category || 'other',
      startTime: activity.startTime,
      endTime: activity.endTime,
      estimatedDuration: activity.estimatedDuration || undefined,
      actualDuration: activity.actualDuration || undefined,
      progress: activity.progress || 0,
      comments: activity.comments,
      images: activity.images || [],
      incidentReport: activity.incidentReport,
      createdBy: new Types.ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add the new activity
    dailyProgress.activities.push(newActivity);

    // Update summary statistics
    const activities = dailyProgress.activities;
    dailyProgress.summary.totalActivities = activities.length;
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;
    dailyProgress.updatedAt = new Date();

    // FIXED: Save with error handling
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

// PUT update existing activity
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can update activities
    if (session.user.role !== 'project_manager' && session.user.role !== 'super_admin') {
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

    // Update activity fields
    activities[activityIndex] = {
      ...activities[activityIndex],
      ...updates,
      updatedBy: new Types.ObjectId(session.user.id),
      updatedAt: new Date()
    };

    // Update summary statistics
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;
    dailyProgress.updatedAt = new Date();

    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      data: dailyProgress,
      message: "Activity updated successfully"
    });

  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE activity
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can delete activities
    if (session.user.role !== 'project_manager' && session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: "Only project managers and admins can delete activities" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const date = searchParams.get("date");
    const activityId = searchParams.get("activityId");

    if (!projectId || !date || !activityId) {
      return NextResponse.json(
        { error: "Project ID, date, and activity ID are required" },
        { status: 400 }
      );
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

    // Remove the activity
    dailyProgress.activities = dailyProgress.activities.filter(
      (a: IDailyActivity) => a._id?.toString() !== activityId
    );

    // Update summary statistics
    const activities = dailyProgress.activities;
    dailyProgress.summary.totalActivities = activities.length;
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;
    dailyProgress.updatedAt = new Date();

    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      data: dailyProgress,
      message: "Activity deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}