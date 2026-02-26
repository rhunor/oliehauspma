// src/app/api/projects/[id]/daily-progress/route.ts
// NEW API: Fetch all daily progress entries for a project

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToMongoose } from '@/lib/db';
import DailyProgress from '@/models/DailyProgress';
import { Types } from 'mongoose';

interface SessionUser {
  id: string;
  role: 'super_admin' | 'project_manager' | 'client';
}

interface AuthSession {
  user: SessionUser;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// GET - Fetch all daily progress for a project
export async function GET(
  request: NextRequest,
  { params }: PageProps
) {
  try {
    const session = await auth() as AuthSession | null;
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToMongoose();
    
    const { id: projectId } = await params;

    if (!Types.ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch daily progress entries
    const dailyProgressEntries = await DailyProgress.find({
      project: new Types.ObjectId(projectId),
      date: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

    // Transform data for response
    const transformedData = dailyProgressEntries.map(entry => ({
      _id: entry._id.toString(),
      date: entry.date,
      activities: entry.activities.map(activity => ({
        _id: activity._id?.toString(),
        title: activity.title,
        description: activity.description,
        contractor: activity.contractor,
        supervisor: activity.supervisor,
        startDate: activity.startDate,
        endDate: activity.endDate,
        status: activity.status,
        priority: activity.priority,
        category: activity.category,
        progress: activity.progress || 0,
        images: activity.images || [],
        comments: activity.comments,
      })),
      summary: entry.summary,
      weatherCondition: entry.weatherCondition,
      siteCondition: entry.siteCondition,
      generalNotes: entry.generalNotes,
    }));

    // Calculate overall stats
    const allActivities = transformedData.flatMap(entry => entry.activities);
    const stats = {
      totalDays: transformedData.length,
      totalActivities: allActivities.length,
      completed: allActivities.filter(a => a.status === 'completed').length,
      inProgress: allActivities.filter(a => a.status === 'in_progress').length,
      delayed: allActivities.filter(a => a.status === 'delayed').length,
      averageActivitiesPerDay: transformedData.length > 0 
        ? Math.round(allActivities.length / transformedData.length) 
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        entries: transformedData,
        stats,
        dateRange: {
          start: startDate,
          end: endDate,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching daily progress:', error);
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