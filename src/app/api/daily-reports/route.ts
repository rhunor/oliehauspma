// src/app/api/daily-reports/route.ts - COMPLETE WITH DELETE METHOD
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// TypeScript interfaces for type safety
interface DailyActivity {
  title: string;
  description?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  startTime?: string;
  endTime?: string;
  contractor?: string;
  supervisor?: string;
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress?: number;
}

interface DailyReportSummary {
  totalHours?: number;
  crewSize?: number;
  weatherConditions?: string;
  safetyIncidents?: number;
}

interface DailyReportResponse {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
  activities: DailyActivity[];
  summary: {
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
    totalActivities: number;
    totalHours?: number;
    crewSize?: number;
    weatherConditions?: string;
  };
  photos: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approved: boolean;
}

// GET daily reports - with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters with defaults
    const projectId = searchParams.get('projectId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const userRole = session.user.role;
    const userId = session.user.id;

    // Build filter based on user role
    const baseFilter: Record<string, unknown> = {};

    if (userRole === 'client') {
      // Client can only see reports for their projects
      const clientProjects = await db.collection('projects')
        .find({ client: new ObjectId(userId) })
        .project({ _id: 1 })
        .toArray();
      const projectIds = clientProjects.map(p => p._id);
      baseFilter.project = { $in: projectIds };
    } else if (userRole === 'project_manager') {
      // Project manager can see reports for their managed projects
      const managerProjects = await db.collection('projects')
        .find({ manager: new ObjectId(userId) })
        .project({ _id: 1 })
        .toArray();
      const projectIds = managerProjects.map(p => p._id);
      baseFilter.project = { $in: projectIds };
    }
    // Super admin can see all reports (no additional filter)

    // Add specific filters with proper typing
    if (projectId) {
      baseFilter.project = new ObjectId(projectId);
    }

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      baseFilter.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    } else if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }
      baseFilter.date = dateFilter;
    }

    // Build aggregation pipeline for enhanced data
    const pipeline = [
      { $match: baseFilter },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectData',
          pipeline: [{ $project: { title: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creatorData',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$projectData', 0] },
          creator: { $arrayElemAt: ['$creatorData', 0] }
        }
      },
      { $sort: { date: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $unset: ['projectData', 'creatorData'] }
    ];

    const reports = await db.collection('dailyProgress').aggregate(pipeline).toArray();
    const totalCount = await db.collection('dailyProgress').countDocuments(baseFilter);

    // Transform data for client consumption
    const transformedReports: DailyReportResponse[] = reports.map(report => ({
      _id: report._id.toString(),
      projectId: report.project._id.toString(),
      projectTitle: report.project?.title || 'Unknown Project',
      date: report.date.toISOString(),
      activities: report.activities || [],
      summary: {
        completed: report.summary?.completed || 0,
        inProgress: report.summary?.inProgress || 0,
        pending: report.summary?.pending || 0,
        delayed: report.summary?.delayed || 0,
        totalActivities: report.summary?.totalActivities || 0,
        totalHours: report.summary?.totalHours,
        crewSize: report.summary?.crewSize,
        weatherConditions: report.summary?.weatherConditions
      },
      photos: report.photos || [],
      notes: report.notes,
      createdBy: report.creator?.name || 'Unknown',
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      approved: report.approved || false
    }));

    return NextResponse.json({
      success: true,
      data: {
        reports: transformedReports,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST new daily report - for project managers and admins with file upload
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can create reports
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can create daily reports" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Handle FormData for file uploads
    const formData = await request.formData();
    
    // Extract form fields
    const projectId = formData.get('projectId') as string;
    const date = formData.get('date') as string;
    const activitiesStr = formData.get('activities') as string;
    const summaryStr = formData.get('summary') as string;
    const notes = formData.get('notes') as string;

    // Validate required fields
    if (!projectId || !date || !activitiesStr) {
      return NextResponse.json(
        { error: "Project ID, date, and activities are required" },
        { status: 400 }
      );
    }

    // Parse JSON data
    let activities: DailyActivity[];
    let summary: DailyReportSummary;
    
    try {
      activities = JSON.parse(activitiesStr);
      summary = summaryStr ? JSON.parse(summaryStr) : {};
    } catch (_parseError) {
      return NextResponse.json(
        { error: "Invalid JSON data in activities or summary" },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const project = await db.collection('projects')
      .findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager' && 
        project.manager.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to create reports for this project" },
        { status: 403 }
      );
    }

    const reportDate = new Date(date);
    const currentDate = new Date();

    // Check if report already exists for this date
    const existingReport = await db.collection('dailyProgress')
      .findOne({
        project: new ObjectId(projectId),
        date: {
          $gte: new Date(reportDate.setHours(0, 0, 0, 0)),
          $lte: new Date(reportDate.setHours(23, 59, 59, 999))
        }
      });

    if (existingReport) {
      return NextResponse.json(
        { error: "Daily report already exists for this date" },
        { status: 409 }
      );
    }

    // Handle file uploads
    const photoUrls: string[] = [];
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'daily-reports');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (_mkdirError) {
      // Directory might already exist
    }

    // Process uploaded files
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo_') && value instanceof File) {
        try {
          const bytes = await value.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          // Generate unique filename
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2);
          const extension = value.name.split('.').pop() || 'jpg';
          const filename = `${timestamp}_${randomString}.${extension}`;
          
          // Save file
          const filepath = join(uploadsDir, filename);
          await writeFile(filepath, buffer);
          
          // Store relative URL
          photoUrls.push(`/uploads/daily-reports/${filename}`);
        } catch (_fileError) {
          console.error('Error saving file:', _fileError);
          // Continue with other files
        }
      }
    }

    // Calculate summary statistics
    const summaryStats = {
      totalActivities: activities.length,
      completed: activities.filter(a => a.status === 'completed').length,
      inProgress: activities.filter(a => a.status === 'in_progress').length,
      pending: activities.filter(a => a.status === 'pending').length,
      delayed: activities.filter(a => a.status === 'delayed').length,
      ...summary
    };

    // Create new daily report
    const newReport = {
      project: new ObjectId(projectId),
      date: new Date(date),
      activities: activities.map(activity => ({
        ...activity,
        _id: new ObjectId(),
        createdAt: currentDate,
        updatedAt: currentDate
      })),
      summary: summaryStats,
      photos: photoUrls,
      notes: notes || '',
      createdBy: new ObjectId(session.user.id),
      createdAt: currentDate,
      updatedAt: currentDate,
      approved: false // Requires approval for client visibility
    };

    const result = await db.collection('dailyProgress')
      .insertOne(newReport);

    return NextResponse.json({
      success: true,
      data: {
        reportId: result.insertedId.toString(),
        message: "Daily report created successfully"
      }
    });

  } catch (error) {
    console.error('Error creating daily report:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT update existing daily report
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can update reports
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can update daily reports" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const body = await request.json();
    
    if (!body.reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Find existing report
    const existingReport = await db.collection('dailyProgress')
      .findOne({ _id: new ObjectId(body.reportId) });

    if (!existingReport) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: existingReport.project });
      
      if (project?.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to update this report" },
          { status: 403 }
        );
      }
    }

    // Update summary if activities are provided
    const updateData = { ...body };
    if (body.activities) {
      const activities = body.activities;
      updateData.summary = {
        ...existingReport.summary,
        totalActivities: activities.length,
        completed: activities.filter((a: DailyActivity) => a.status === 'completed').length,
        inProgress: activities.filter((a: DailyActivity) => a.status === 'in_progress').length,
        pending: activities.filter((a: DailyActivity) => a.status === 'pending').length,
        delayed: activities.filter((a: DailyActivity) => a.status === 'delayed').length,
        ...body.summary
      };
    }

    updateData.updatedAt = new Date();
    updateData.updatedBy = new ObjectId(session.user.id);
    
    // Remove reportId from update data
    delete updateData.reportId;

    await db.collection('dailyProgress')
      .updateOne(
        { _id: new ObjectId(body.reportId) },
        { $set: updateData }
      );

    return NextResponse.json({
      success: true,
      message: "Daily report updated successfully"
    });

  } catch (error) {
    console.error('Error updating daily report:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE daily report
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can delete reports
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can delete daily reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Find existing report
    const existingReport = await db.collection('dailyProgress')
      .findOne({ _id: new ObjectId(reportId) });

    if (!existingReport) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: existingReport.project });
      
      if (project?.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to delete this report" },
          { status: 403 }
        );
      }
    }

    // Delete the report
    await db.collection('dailyProgress')
      .deleteOne({ _id: new ObjectId(reportId) });

    return NextResponse.json({
      success: true,
      message: "Daily report deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting daily report:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}