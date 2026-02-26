// src/app/api/projects/[id]/schedule/activities/route.ts - NEW ACTIVITIES API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define schedule activity structure for database operations
interface ScheduleActivityDocument {
  _id: ObjectId;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
  resources?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define project document with nested schedule structure
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
  siteSchedule?: {
    phases: Array<{
      _id: ObjectId;
      name: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      status: 'upcoming' | 'active' | 'completed' | 'delayed';
      progress: number;
      activities: ScheduleActivityDocument[];
      dependencies?: string[];
      createdAt: Date;
      updatedAt: Date;
    }>;
    lastUpdated: Date;
    overallProgress: number;
    totalActivities: number;
    completedActivities: number;
    activeActivities: number;
    delayedActivities: number;
  };
}

// Define create activity request
interface CreateActivityRequest {
  phaseId: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  dependencies?: string[];
  resources?: string[];
  notes?: string;
  estimatedDuration?: number;
}

interface ActivitiesPageProps {
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

// POST /api/projects/[id]/schedule/activities - Create new activity
export async function POST(
  request: NextRequest,
  { params }: ActivitiesPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only project managers and super admins can create activities
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to create activities'
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

    const body = await request.json() as CreateActivityRequest;

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Activity title is required'
      }, { status: 400 });
    }

    if (!body.contractor?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Contractor is required'
      }, { status: 400 });
    }

    if (!body.plannedStartDate || !body.plannedEndDate) {
      return NextResponse.json({
        success: false,
        error: 'Planned start and end dates are required'
      }, { status: 400 });
    }

    if (!ObjectId.isValid(body.phaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phase ID'
      }, { status: 400 });
    }

    // Validate dates
    const startDate = new Date(body.plannedStartDate);
    const endDate = new Date(body.plannedEndDate);
    
    if (startDate >= endDate) {
      return NextResponse.json({
        success: false,
        error: 'End date must be after start date'
      }, { status: 400 });
    }

    // Find the target phase
    const targetPhaseId = new ObjectId(body.phaseId);
    const targetPhase = project.siteSchedule?.phases?.find(phase => 
      phase._id.equals(targetPhaseId)
    );

    if (!targetPhase) {
      return NextResponse.json({
        success: false,
        error: 'Target phase not found'
      }, { status: 404 });
    }

    // Create new activity
    const newActivity: ScheduleActivityDocument = {
      _id: new ObjectId(),
      title: body.title.trim(),
      description: body.description?.trim() || '',
      contractor: body.contractor.trim(),
      supervisor: body.supervisor?.trim(),
      plannedStartDate: startDate,
      plannedEndDate: endDate,
      status: 'pending',
      priority: body.priority || 'medium',
      category: body.category || 'other',
      progress: 0,
      estimatedDuration: body.estimatedDuration,
      dependencies: body.dependencies || [],
      resources: body.resources || [],
      notes: body.notes?.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add activity to the specific phase
    const { db } = await connectToDatabase();
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { 
        _id: new ObjectId(projectId),
        'siteSchedule.phases._id': targetPhaseId
      },
      {
        $push: { 'siteSchedule.phases.$.activities': newActivity },
        $set: { 
          'siteSchedule.lastUpdated': new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create activity'
      }, { status: 500 });
    }

    // Return created activity
    return NextResponse.json({
      success: true,
      data: {
        _id: newActivity._id.toString(),
        title: newActivity.title,
        description: newActivity.description,
        contractor: newActivity.contractor,
        supervisor: newActivity.supervisor,
        plannedStartDate: newActivity.plannedStartDate.toISOString(),
        plannedEndDate: newActivity.plannedEndDate.toISOString(),
        status: newActivity.status,
        priority: newActivity.priority,
        category: newActivity.category,
        progress: newActivity.progress,
        estimatedDuration: newActivity.estimatedDuration,
        dependencies: newActivity.dependencies,
        resources: newActivity.resources,
        notes: newActivity.notes,
        createdAt: newActivity.createdAt.toISOString(),
        updatedAt: newActivity.updatedAt.toISOString()
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating schedule activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// PUT /api/projects/[id]/schedule/activities - Update activity
export async function PUT(
  request: NextRequest,
  { params }: ActivitiesPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only project managers and super admins can update activities
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to update activities'
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

    const body = await request.json();
    const { activityId, phaseId, updates } = body;

    if (!ObjectId.isValid(activityId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid activity ID'
      }, { status: 400 });
    }

    if (!ObjectId.isValid(phaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phase ID'
      }, { status: 400 });
    }

    // Build update object
    const updateFields: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'description', 'contractor', 'supervisor',
      'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate',
      'status', 'priority', 'category', 'progress', 'estimatedDuration',
      'actualDuration', 'dependencies', 'resources', 'notes'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (['plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate'].includes(field)) {
          updateFields[`siteSchedule.phases.$[phase].activities.$[activity].${field}`] = 
            updates[field] ? new Date(updates[field]) : null;
        } else {
          updateFields[`siteSchedule.phases.$[phase].activities.$[activity].${field}`] = updates[field];
        }
      }
    }

    updateFields['siteSchedule.phases.$[phase].activities.$[activity].updatedAt'] = new Date();
    updateFields['siteSchedule.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();

    // Update activity using positional operators
    const { db } = await connectToDatabase();
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: updateFields },
      {
        arrayFilters: [
          { 'phase._id': new ObjectId(phaseId) },
          { 'activity._id': new ObjectId(activityId) }
        ]
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activity not found or update failed'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating schedule activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/schedule/activities - Delete activity
export async function DELETE(
  request: NextRequest,
  { params }: ActivitiesPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only project managers and super admins can delete activities
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to delete activities'
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

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('activityId');
    const phaseId = searchParams.get('phaseId');

    if (!activityId || !ObjectId.isValid(activityId)) {
      return NextResponse.json({
        success: false,
        error: 'Valid activity ID is required'
      }, { status: 400 });
    }

    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Valid phase ID is required'
      }, { status: 400 });
    }

    // Remove activity from phase
    const { db } = await connectToDatabase();
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { 
        _id: new ObjectId(projectId),
        'siteSchedule.phases._id': new ObjectId(phaseId)
      },
      {
        $pull: { 
          'siteSchedule.phases.$.activities': { 
            _id: new ObjectId(activityId) 
          } 
        },
        $set: { 
          'siteSchedule.lastUpdated': new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0 || result.modifiedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activity not found or deletion failed'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting schedule activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}