// src/app/api/site-schedule/daily/route.ts
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

// POST new daily activity
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
        { error: "Only project managers can add activities" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const body = await request.json();
    const { projectId, date, activity } = body;

    if (!projectId || !date || !activity) {
      return NextResponse.json(
        { error: "Project ID, date, and activity data are required" },
        { status: 400 }
      );
    }

    // Find or create daily progress document
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
          delayed: 0
        },
        approved: false
      }) as IDailyProgressDocument;
    }

    // Add the new activity
    const newActivity: IDailyActivity = {
      ...activity,
      createdBy: new Types.ObjectId(session.user.id),
      createdAt: new Date()
    };
    
    dailyProgress.activities.push(newActivity);

    // Update summary statistics with proper typing
    const activities = dailyProgress.activities;
    dailyProgress.summary.totalActivities = activities.length;
    dailyProgress.summary.completed = activities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = activities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = activities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = activities.filter((a: IDailyActivity) => a.status === 'delayed').length;

    await dailyProgress.save();

    return NextResponse.json({
      success: true,
      data: dailyProgress,
      message: "Activity added successfully"
    });

  } catch (error) {
    console.error("Error adding daily activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
        { error: "Only project managers can update activities" },
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

    // Find and update the activity with proper typing
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
        { error: "Only project managers can delete activities" },
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
        { error: "All parameters are required" },
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

    // Remove the activity with proper typing
    const activities = dailyProgress.activities;
    dailyProgress.activities = activities.filter(
      (a: IDailyActivity) => a._id?.toString() !== activityId
    );

    // Update summary statistics
    const updatedActivities = dailyProgress.activities;
    dailyProgress.summary.totalActivities = updatedActivities.length;
    dailyProgress.summary.completed = updatedActivities.filter((a: IDailyActivity) => a.status === 'completed').length;
    dailyProgress.summary.inProgress = updatedActivities.filter((a: IDailyActivity) => a.status === 'in_progress').length;
    dailyProgress.summary.pending = updatedActivities.filter((a: IDailyActivity) => a.status === 'pending').length;
    dailyProgress.summary.delayed = updatedActivities.filter((a: IDailyActivity) => a.status === 'delayed').length;

    await dailyProgress.save();

    return NextResponse.json({
      success: true,
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