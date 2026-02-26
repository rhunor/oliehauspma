// src/app/api/site-schedule/activities/route.ts
// UPDATED: Added 'to-do' status support

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import DailyProgress, { IDailyActivity } from "@/models/DailyProgress";
import Project from "@/models/Project";
import { Types } from "mongoose";

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
  priority: string;
  category: string;
  comments?: string;
  images?: string[];
  projectId: string;
  projectTitle: string;
  date: Date;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface QueryFilter {
  project?: { $in: Types.ObjectId[] } | Types.ObjectId;
}

interface PopulatedProject {
  _id: Types.ObjectId;
  title: string;
}

// GET activities with optional manager filtering
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
    const isManager = searchParams.get("manager") === "true";
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    let query: QueryFilter = {};
    let projectIds: Types.ObjectId[] = [];

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

    if (projectId) {
      query = { ...query, project: new Types.ObjectId(projectId) };
    }

    const dailyProgressDocs = await DailyProgress.find(query)
      .populate<{ project: PopulatedProject }>('project', 'title')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip);

    const allActivities: ActivityResponse[] = [];
    
    dailyProgressDocs.forEach(doc => {
      if (!doc.project || typeof doc.project !== 'object' || !('title' in doc.project)) {
        return;
      }

      const populatedProject = doc.project as PopulatedProject;

      doc.activities.forEach((activity: IDailyActivity) => {
        // Filter by status if requested (including 'to-do')
        if (status && activity.status !== status) {
          return;
        }

        allActivities.push({
          _id: activity._id?.toString() || '',
          title: activity.title || '',
          description: activity.description,
          contractor: activity.contractor || '',
          supervisor: activity.supervisor,
          startDate: activity.startDate ? activity.startDate.toISOString() : new Date().toISOString(),
          endDate: activity.endDate ? activity.endDate.toISOString() : new Date().toISOString(),
          status: activity.status || 'to-do', // UPDATED: Default to 'to-do'
          priority: activity.priority || 'medium',
          category: activity.category || 'other',
          comments: activity.comments,
          images: activity.images || [],
          projectId: populatedProject._id.toString(),
          projectTitle: populatedProject.title,
          date: doc.date,
          createdAt: activity.createdAt || doc.createdAt,
          updatedAt: activity.updatedAt || doc.updatedAt
        });
      });
    });

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
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });

  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}