// src/app/api/projects/[id]/milestones/route.ts - NEW MILESTONES API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define milestone document structure
interface MilestoneDocument {
  _id: ObjectId; // Remove optional - always required for our use case
  title: string;
  description: string;
  dueDate: Date;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: ObjectId;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Define project document structure
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
  milestones: MilestoneDocument[];
}

// Define user document structure
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
}

// Define milestone response structure
interface MilestoneResponse {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Define create milestone request
interface CreateMilestoneRequest {
  title: string;
  description: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  dependencies?: string[];
}

interface MilestonesPageProps {
  params: Promise<{ id: string }>;
}

async function validateProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<ProjectDocument | null> {
  const { db } = await connectToDatabase();

  if (!ObjectId.isValid(projectId)) {
    return null;
  }

  const projectFilter: Filter<ProjectDocument> = { _id: new ObjectId(projectId) };

  // Role-based access control
  if (userRole === 'client') {
    projectFilter.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectFilter.manager = new ObjectId(userId);
  }
  // super_admin can access all projects

  return await db.collection<ProjectDocument>('projects').findOne(projectFilter);
}

// GET /api/projects/[id]/milestones - Get project milestones
export async function GET(
  request: NextRequest,
  { params }: MilestonesPageProps
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await validateProjectAccess(projectId, session.user.id, session.user.role);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 });
    }

    const { db } = await connectToDatabase();

    // Get milestones with assigned user details
    const milestones = project.milestones || [];
    const transformedMilestones: MilestoneResponse[] = [];

    for (const milestone of milestones) {
      let assignedUser = null;
      if (milestone.assignedTo) {
        assignedUser = await db.collection<UserDocument>('users')
          .findOne({ _id: milestone.assignedTo }, { projection: { password: 0 } });
      }

      // Update status based on current date
      let status = milestone.status;
      const now = new Date();
      const dueDate = new Date(milestone.dueDate);

      if (status === 'completed') {
        status = 'completed';
      } else if (dueDate < now) {
        status = 'overdue';
      } else if (status === 'in_progress') {
        status = 'in_progress';
      } else {
        status = 'upcoming';
      }

      transformedMilestones.push({
        _id: milestone._id.toString(), // Now guaranteed to exist
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate.toISOString(),
        status,
        progress: milestone.progress,
        priority: milestone.priority,
        dependencies: milestone.dependencies || [],
        assignedTo: assignedUser ? {
          _id: assignedUser._id.toString(),
          name: assignedUser.name,
          email: assignedUser.email
        } : undefined,
        completedDate: milestone.completedDate?.toISOString(),
        createdAt: milestone.createdAt.toISOString(),
        updatedAt: milestone.updatedAt.toISOString()
      });
    }

    // Sort by due date
    transformedMilestones.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectTitle: project.title,
        milestones: transformedMilestones
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching milestones:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/milestones - Create new milestone
export async function POST(
  request: NextRequest,
  { params }: MilestonesPageProps
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only project managers and super admins can create milestones
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to create milestones'
      }, { status: 403 });
    }

    const { id: projectId } = await params;
    const project = await validateProjectAccess(projectId, session.user.id, session.user.role);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 });
    }

    const body = await request.json() as CreateMilestoneRequest;

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Title is required'
      }, { status: 400 });
    }

    if (!body.dueDate) {
      return NextResponse.json({
        success: false,
        error: 'Due date is required'
      }, { status: 400 });
    }

    // Validate assigned user if provided
    const { db } = await connectToDatabase();
    let assignedToObjectId: ObjectId | undefined;
    
    if (body.assignedTo) {
      if (!ObjectId.isValid(body.assignedTo)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid assigned user ID'
        }, { status: 400 });
      }

      const assignedUser = await db.collection<UserDocument>('users')
        .findOne({ _id: new ObjectId(body.assignedTo), isActive: true });

      if (!assignedUser) {
        return NextResponse.json({
          success: false,
          error: 'Assigned user not found or inactive'
        }, { status: 400 });
      }

      assignedToObjectId = new ObjectId(body.assignedTo);
    }

    // Create new milestone
    const newMilestone: MilestoneDocument = {
      _id: new ObjectId(),
      title: body.title.trim(),
      description: body.description?.trim() || '',
      dueDate: new Date(body.dueDate),
      status: 'upcoming',
      progress: 0,
      priority: body.priority || 'medium',
      dependencies: body.dependencies || [],
      assignedTo: assignedToObjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add milestone to project
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $push: { milestones: newMilestone },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create milestone'
      }, { status: 500 });
    }

    // Return created milestone
    const createdMilestone: MilestoneResponse = {
      _id: newMilestone._id.toString(), // Now guaranteed to exist
      title: newMilestone.title,
      description: newMilestone.description,
      dueDate: newMilestone.dueDate.toISOString(),
      status: newMilestone.status,
      progress: newMilestone.progress,
      priority: newMilestone.priority,
      dependencies: newMilestone.dependencies,
      createdAt: newMilestone.createdAt.toISOString(),
      updatedAt: newMilestone.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: createdMilestone
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating milestone:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}