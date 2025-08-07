// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { updateTaskSchema } from '@/lib/validation';
import { ObjectId, Db } from 'mongodb';

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
    const taskId = params.id;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Get task with populated data
    const tasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1, client: 1, manager: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignee',
            foreignField: '_id',
            as: 'assigneeData',
            pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorData',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] },
            assignee: { $arrayElemAt: ['$assigneeData', 0] },
            createdBy: { $arrayElemAt: ['$creatorData', 0] }
          }
        },
        { $unset: ['projectData', 'assigneeData', 'creatorData'] }
      ])
      .toArray();

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = tasks[0];

    // Check permission
    const canAccess = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && task.project.manager.toString() === session.user.id) ||
      (session.user.role === 'client' && task.project.client.toString() === session.user.id) ||
      (task.assignee._id.toString() === session.user.id);

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task,
    });

  } catch (error) {
    console.error('Error fetching task:', error);
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
    const taskId = params.id;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Get existing task with project info
    const existingTasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { manager: 1, client: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] }
          }
        }
      ])
      .toArray();

    if (existingTasks.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const existingTask = existingTasks[0];

    // Check permission
    const canEdit = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && existingTask.project.manager.toString() === session.user.id) ||
      (existingTask.assignee.toString() === session.user.id); // Assignee can update status

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = updateTaskSchema.safeParse(body);
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
    
    // Prepare update object with proper typing
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Only allow certain fields to be updated by assignees
    const isAssignee = existingTask.assignee.toString() === session.user.id;
    const isManager = session.user.role === 'project_manager' && existingTask.project.manager.toString() === session.user.id;
    const isSuperAdmin = session.user.role === 'super_admin';

    if (updateData.title && (isManager || isSuperAdmin)) update.title = updateData.title;
    if (updateData.description && (isManager || isSuperAdmin)) update.description = updateData.description;
    if (updateData.status) update.status = updateData.status;
    if (updateData.priority && (isManager || isSuperAdmin)) update.priority = updateData.priority;
    if (updateData.deadline && (isManager || isSuperAdmin)) update.deadline = new Date(updateData.deadline);
    if (updateData.estimatedHours && (isManager || isSuperAdmin)) update.estimatedHours = updateData.estimatedHours;
    if (updateData.actualHours !== undefined && isAssignee) update.actualHours = updateData.actualHours;

    // Handle status change notifications
    const statusChanged = updateData.status && updateData.status !== existingTask.status;
    const wasCompleted = updateData.status === 'completed' && existingTask.status !== 'completed';

    // Update task
    const result = await db.collection('tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Handle completion
    if (wasCompleted) {
      const completedAt = new Date();
      await db.collection('tasks').updateOne(
        { _id: new ObjectId(taskId) },
        { $set: { completedAt } }
      );

      // Create notification for project manager
      await db.collection('notifications').insertOne({
        recipient: existingTask.project.manager,
        sender: new ObjectId(session.user.id),
        type: 'task_completed',
        title: 'Task Completed',
        message: `Task "${existingTask.title}" has been completed`,
        data: {
          taskId: new ObjectId(taskId),
          projectId: existingTask.projectId
        },
        isRead: false,
        createdAt: new Date(),
      });

      // Update project progress
      await updateProjectProgress(db, existingTask.projectId);
    }

    // Create notification for status changes
    if (statusChanged && !isAssignee) {
      await db.collection('notifications').insertOne({
        recipient: existingTask.assignee,
        sender: new ObjectId(session.user.id),
        type: 'task_updated',
        title: 'Task Updated',
        message: `Task "${existingTask.title}" status changed to ${updateData.status}`,
        data: {
          taskId: new ObjectId(taskId),
          projectId: existingTask.projectId
        },
        isRead: false,
        createdAt: new Date(),
      });
    }

    // Return updated task with populated data
    const updatedTasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1, client: 1, manager: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignee',
            foreignField: '_id',
            as: 'assigneeData',
            pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorData',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] },
            assignee: { $arrayElemAt: ['$assigneeData', 0] },
            createdBy: { $arrayElemAt: ['$creatorData', 0] }
          }
        },
        { $unset: ['projectData', 'assigneeData', 'creatorData'] }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: updatedTasks[0],
      message: 'Task updated successfully',
    });

  } catch (error: unknown) {
    console.error('Error updating task:', error);
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

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const taskId = params.id;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Get existing task with project info
    const existingTasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { manager: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] }
          }
        }
      ])
      .toArray();

    if (existingTasks.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const existingTask = existingTasks[0];

    // Check permission (only super admin and project manager can delete)
    const canDelete = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && existingTask.project.manager.toString() === session.user.id);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete task
    const result = await db.collection('tasks').deleteOne({
      _id: new ObjectId(taskId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Remove task from project using proper MongoDB update operation
    await db.collection('projects').updateOne(
      { _id: existingTask.projectId },
      { 
        $pull: { tasks: new ObjectId(taskId) },
        $set: { updatedAt: new Date() }
      } as Record<string, unknown>
    );

    // Delete related notifications
    await db.collection('notifications').deleteMany({
      'data.taskId': new ObjectId(taskId)
    });

    // Update project progress
    await updateProjectProgress(db, existingTask.projectId);

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });

  } catch (error: unknown) {
    console.error('Error deleting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to update project progress with proper typing
async function updateProjectProgress(db: Db, projectId: ObjectId) {
  try {
    interface TaskDocument {
      status: string;
      [key: string]: unknown;
    }

    const projectTasks = await db.collection<TaskDocument>('tasks')
      .find({ projectId: projectId })
      .toArray();

    if (projectTasks.length === 0) {
      await db.collection('projects').updateOne(
        { _id: projectId },
        { $set: { progress: 0, updatedAt: new Date() } }
      );
      return;
    }

    const completedTasks = projectTasks.filter((task: TaskDocument) => task.status === 'completed').length;
    const progress = Math.round((completedTasks / projectTasks.length) * 100);

    await db.collection('projects').updateOne(
      { _id: projectId },
      { $set: { progress: progress, updatedAt: new Date() } }
    );

  } catch (error) {
    console.error('Error updating project progress:', error);
  }
}