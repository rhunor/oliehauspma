// FILE: src/app/api/site-schedule/activities/route.ts
// ✅ FIXED: Using proper Mongoose populate generics instead of type assertions

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import DailyProgress, { IDailyActivity } from "@/models/DailyProgress";
import Project from "@/models/Project";

// ✅ ADDED: Interface for the flattened activity response
interface ActivityResponse {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor: string;
  plannedDate: Date | string;
  actualDate?: Date | string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: string;
  category: string;
  comments?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  projectId: string;
  projectTitle: string;
  date: Date;
  createdAt: Date | string;
  updatedAt: Date | string;
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

    let query = {};
    let projectIds: string[] = [];

    // If manager filter is requested, get only manager's projects
    if (isManager && session.user.role === 'project_manager') {
      const managerProjects = await Project.find(
        { manager: session.user.id },
        { _id: 1 }
      );
      projectIds = managerProjects.map(p => p._id.toString());
      
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
      query = { ...query, project: projectId };
    }

    // ✅ FIXED: Use Mongoose's populate generic syntax instead of type assertion
    const dailyProgressDocs = await DailyProgress.find(query)
      .populate<{ project: { _id: string; title: string } }>('project', 'title')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip);

    // Extract and flatten all activities
    const allActivities: ActivityResponse[] = [];
    
    dailyProgressDocs.forEach(doc => {
      doc.activities.forEach((activity: IDailyActivity) => {
        // Filter by status if requested
        if (status && activity.status !== status) {
          return;
        }

        allActivities.push({
          _id: activity._id?.toString() || '',
          title: activity.title || '',
          description: activity.description,
          contractor: activity.contractor || '',
          supervisor: activity.supervisor || '',
          plannedDate: activity.createdAt || doc.date,
          actualDate: activity.actualDate,
          status: activity.status || 'pending',
          priority: activity.priority || 'medium',
          category: activity.category || 'other',
          comments: activity.comments,
          estimatedDuration: activity.estimatedDuration,
          actualDuration: activity.actualDuration,
          projectId: doc.project._id.toString(),
          projectTitle: doc.project.title,
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