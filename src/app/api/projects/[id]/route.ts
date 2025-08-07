// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { updateProjectSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get project with populated user data
    const projects = await db.collection('projects')
      .aggregate([
        { $match: { _id: new ObjectId(projectId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] }
      ])
      .toArray();

    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const project = projects[0];

    // Check permission
    const canAccess = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && project.manager._id.toString() === session.user.id) ||
      (session.user.role === 'client' && project.client._id.toString() === session.user.id);

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get existing project
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && existingProject.manager.toString() === session.user.id);

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = updateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;
    
    // Prepare update object
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updateData.title) update.title = updateData.title;
    if (updateData.description) update.description = updateData.description;
    if (updateData.status) update.status = updateData.status;
    if (updateData.priority) update.priority = updateData.priority;
    if (updateData.startDate) update.startDate = new Date(updateData.startDate);
    if (updateData.endDate) update.endDate = new Date(updateData.endDate);
    if (updateData.budget !== undefined) update.budget = updateData.budget;
    if (updateData.tags) update.tags = updateData.tags;
    if (updateData.notes !== undefined) update.notes = updateData.notes;

    // Update project
    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Return updated project with populated user data
    const updatedProjects = await db.collection('projects')
      .aggregate([
        { $match: { _id: new ObjectId(projectId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: updatedProjects[0],
      message: 'Project updated successfully',
    });

  } catch (error: unknown) {
    console.error('Error updating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Check if project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete related data
    await Promise.all([
      // Delete tasks
      db.collection('tasks').deleteMany({ projectId: new ObjectId(projectId) }),
      // Delete messages
      db.collection('chatmessages').deleteMany({ projectId: new ObjectId(projectId) }),
      // Delete files
      db.collection('projectfiles').deleteMany({ projectId: new ObjectId(projectId) }),
      // Delete notifications
      db.collection('notifications').deleteMany({ 'data.projectId': new ObjectId(projectId) }),
    ]);

    // Delete project
    const result = await db.collection('projects').deleteOne({
      _id: new ObjectId(projectId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });

  } catch (error: unknown) {
    console.error('Error deleting project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}