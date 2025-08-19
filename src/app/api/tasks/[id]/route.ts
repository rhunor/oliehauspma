// src/app/api/tasks/[id]/route.ts - Individual Task Management
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const taskId = params.id;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid task ID'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Get task with all populated fields
    const tasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'assigneeId',
            foreignField: '_id',
            as: 'assignee',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        {
          $lookup: {
            from: 'tasks',
            localField: 'dependencies',
            foreignField: '_id',
            as: 'dependentTasks',
            pipeline: [{ $project: { title: 1, status: 1 } }]
          }
        },
        {
          $addFields: {
            assignee: { $arrayElemAt: ['$assignee', 0] },
            creator: { $arrayElemAt: ['$creator', 0] },
            project: { $arrayElemAt: ['$project', 0] }
          }
        }
      ])
      .toArray();

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Task not found'
      }, { status: 404 });
    }

    const task = tasks[0];

    // Check access permission
    const hasAccess = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && task.project.manager.equals(new ObjectId(session.user.id))) ||
      (session.user.role === 'client' && task.project.client.equals(new ObjectId(session.user.id))) ||
      task.assigneeId?.equals(new ObjectId(session.user.id)) ||
      task.createdBy.equals(new ObjectId(session.user.id));

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: task
    });

  } catch (error: unknown) {
    console.error('Error fetching task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const taskId = params.id;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid task ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate,
      startDate,
      estimatedHours,
      actualHours,
      progress,
      tags,
      completedDate
    } = body;

    const { db } = await connectToDatabase();

    // Get existing task to verify permissions
    const existingTask = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$project', 0] }
          }
        }
      ])
      .toArray();

    if (existingTask.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Task not found'
      }, { status: 404 });
    }

    const task = existingTask[0];

    // Check permission to update
    const canUpdate = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && task.project.manager.equals(new ObjectId(session.user.id))) ||
      task.assigneeId?.equals(new ObjectId(session.user.id)) ||
      task.createdBy.equals(new ObjectId(session.user.id));

    if (!canUpdate) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId ? new ObjectId(assigneeId) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours;
    if (actualHours !== undefined) updateData.actualHours = actualHours;
    if (progress !== undefined) updateData.progress = Math.max(0, Math.min(100, progress));
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];

    // Handle completion
    if (status === 'completed' && task.status !== 'completed') {
      updateData.completedDate = new Date();
      updateData.progress = 100;
    } else if (status !== 'completed' && task.status === 'completed') {
      updateData.completedDate = null;
    }

    // Update task
    await db.collection('tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $set: updateData }
    );

    // Create notifications for status changes
    if (status && status !== task.status) {
      const notifications = [];

      // Notify assignee about status change (if not the one updating)
      if (task.assigneeId && !task.assigneeId.equals(new ObjectId(session.user.id))) {
        notifications.push({
          recipientId: task.assigneeId,
          senderId: new ObjectId(session.user.id),
          type: status === 'completed' ? 'task_completed' : 'project_updated',
          title: 'Task Status Updated',
          message: `Task "${task.title}" status changed to ${status}`,
          data: {
            projectId: task.projectId.toString(),
            taskId: taskId,
            url: `/projects/${task.projectId}/tasks/${taskId}`
          },
          isRead: false,
          priority: 'medium',
          category: status === 'completed' ? 'success' : 'info',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Notify project manager about completion
      if (status === 'completed' && task.project.manager && !task.project.manager.equals(new ObjectId(session.user.id))) {
        notifications.push({
          recipientId: task.project.manager,
          senderId: new ObjectId(session.user.id),
          type: 'task_completed',
          title: 'Task Completed',
          message: `Task "${task.title}" has been marked as completed`,
          data: {
            projectId: task.projectId.toString(),
            taskId: taskId,
            url: `/projects/${task.projectId}/tasks/${taskId}`
          },
          isRead: false,
          priority: 'medium',
          category: 'success',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
      }
    }

    // Get updated task
    const updatedTask = await db.collection('tasks')
      .aggregate([
        { $match: { _id: new ObjectId(taskId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'assigneeId',
            foreignField: '_id',
            as: 'assignee',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creator',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            assignee: { $arrayElemAt: ['$assignee', 0] },
            creator: { $arrayElemAt: ['$creator', 0] }
          }
        }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: updatedTask[0],
      message: 'Task updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}