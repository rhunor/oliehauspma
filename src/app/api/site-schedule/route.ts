// src/app/api/site-schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToMongoose } from "@/lib/db";
import Project from "@/models/Project";

// GET all schedule data for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use connectToMongoose from your db.ts file
    await connectToMongoose();
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId)
      .populate('client', 'name email')
      .populate('manager', 'name email');

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const userRole = session.user.role;
    const userId = session.user.id;

    if (userRole === 'client' && project.client.toString() !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to view this project" },
        { status: 403 }
      );
    }

    if (userRole === 'project_manager' && project.manager.toString() !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to view this project" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project.siteSchedule || {
        phases: [],
        totalActivities: 0,
        completedActivities: 0
      }
    });

  } catch (error) {
    console.error("Error fetching site schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST new schedule or update existing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only project managers and super admins can create/update schedules
    if (session.user.role !== 'project_manager' && session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: "Only project managers can create schedules" },
        { status: 403 }
      );
    }

    await connectToMongoose();
    
    const body = await request.json();
    const { projectId, scheduleData } = body;

    if (!projectId || !scheduleData) {
      return NextResponse.json(
        { error: "Project ID and schedule data are required" },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check if user is authorized to modify this project
    if (session.user.role === 'project_manager' && 
        project.manager.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to modify this project" },
        { status: 403 }
      );
    }

    // Update the site schedule
    project.siteSchedule = scheduleData;
    await project.save();

    return NextResponse.json({
      success: true,
      data: project.siteSchedule,
      message: "Site schedule updated successfully"
    });

  } catch (error) {
    console.error("Error updating site schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}