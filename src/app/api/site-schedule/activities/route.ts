// src/app/api/site-schedule/activities/route.ts
// UPDATED: Added startDate, endDate; Removed duration fields

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import DailyProgress, { IDailyActivity } from "@/models/DailyProgress";
import Project from "@/models/Project";
import { Types } from "mongoose";

// UPDATED: Response interface with new fields
interface ActivityResponse {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  startDate: string; // ADDED: Required start date-time
  endDate: string;   // ADDED: Required end date-time
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: string;
  category: string;
  comments?: string;
  images?: string[]; // ADDED: S3 image URLs
  // REMOVED: estimatedDuration and actualDuration
  projectId: string;
  projectTitle: string;
  date: Date;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Type-safe MongoDB query filter
interface QueryFilter {
  project?: { $in: Types.ObjectId[] } | Types.ObjectId;
}

// Type-safe populated project interface
interface PopulatedProject {
  _id: Types.ObjectId;
  title: string;
}

// GET activities with optional manager filtering
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
    const isManager = searchParams.get("manager") === "true";
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    let query: QueryFilter = {};
    let projectIds: Types.ObjectId[] = [];

    // If manager filter is requested, get only manager's projects
    if (isManager && session.user.role === 'project_manager') {
      const managerProjects = await Project.find(
        { managers: session.user.id },
        { _id: 1 }
      );
      projectIds = managerProjects.map(p => p._id as Types.ObjectId);
      
      if (projectIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          message: "No projects found for this manager"
        });
      }
      
      query = { project: { $in: projectIds } };
    }

    // If specific project is requested
    if (projectId) {
      query = { ...query, project: new Types.ObjectId(projectId) };
    }

    // FIXED: Type-safe populate with generic
    const dailyProgressDocs = await DailyProgress.find(query)
      .populate<{ project: PopulatedProject }>('project', 'title')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip);

    // Extract and flatten all activities
    const allActivities: ActivityResponse[] = [];
    
    dailyProgressDocs.forEach(doc => {
      // Type guard to ensure project is populated
      if (!doc.project || typeof doc.project !== 'object' || !('title' in doc.project)) {
        return;
      }

      const populatedProject = doc.project as PopulatedProject;

      doc.activities.forEach((activity: IDailyActivity) => {
        // Filter by status if requested
        if (status && activity.status !== status) {
          return;
        }

        // UPDATED: Map activity with new fields, removed duration
        allActivities.push({
          _id: activity._id?.toString() || '',
          title: activity.title || '',
          description: activity.description,
          contractor: activity.contractor || '',
          supervisor: activity.supervisor,
          startDate: activity.startDate ? activity.startDate.toISOString() : new Date().toISOString(), // ADDED
          endDate: activity.endDate ? activity.endDate.toISOString() : new Date().toISOString(), // ADDED
          status: activity.status || 'pending',
          priority: activity.priority || 'medium',
          category: activity.category || 'other',
          comments: activity.comments,
          images: activity.images || [], // ADDED
          // REMOVED: estimatedDuration and actualDuration
          projectId: populatedProject._id.toString(),
          projectTitle: populatedProject.title,
          date: doc.date,
          createdAt: activity.createdAt || doc.createdAt,
          updatedAt: activity.updatedAt || doc.updatedAt
        });
      });
    });

    // Sort activities by creation date (newest first)
    allActivities.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = allActivities.length;
    const paginatedActivities = allActivities.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: paginatedActivities,
      total,
      pagination: {
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: skip > 0
      }
    });

  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}