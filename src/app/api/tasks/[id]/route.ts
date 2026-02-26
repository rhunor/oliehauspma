// src/app/api/tasks/[id]/route.ts - Individual Task Operations
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { updateTaskSchema } from '@/lib/validation';
import { ObjectId, Filter } from 'mongodb';
import { sendNotificationEmail } from '@/lib/email';

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

// Document interfaces
interface TaskDocument {
  _id: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignedTo?: ObjectId;
  createdBy: ObjectId;
  status: string;
  priority: string;
  startDate?: Date;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: ObjectId[];
  comments?: Array<{
    _id: ObjectId;
    content: string;
    authorId: ObjectId;
    createdAt: Date;
    isInternal: boolean;
  }>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client?: ObjectId;
  manager?: ObjectId;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

// Aggregation result interface - FIXED: Don't extend TaskDocument since types are different after $lookup
interface TaskAggregationResult {
  _id: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignedTo?: UserDocument; // Different type after $lookup
  createdBy?: UserDocument; // Different type after $lookup
  status: string;
  priority: string;
  startDate?: Date;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: ObjectId[];
  comments?: Array<{
    _id: ObjectId;
    content: string;
    authorId: ObjectId;
    createdAt: Date;
    isInternal: boolean;
  }>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  project?: Pick<ProjectDocument, '_id' | 'title' | 'client' | 'manager'>;
  dependencyTasks?: Array<Pick<TaskDocument, '_id' | 'title' | 'status'>>;
  commentAuthors?: UserDocument[];
}

// GET /api/tasks/[id] - Get specific task
export async function GET(
  request: NextRequest,
  { params }: TaskDetailPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid task ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Build access filter based on user role - FIXED: Use const instead of let
    const accessFilter: Filter<TaskDocument> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      // Clients can only see tasks in their projects
      const clientProjects = await db.collection<ProjectDocument>('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      
      const projectIds = clientProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    } else if (session.user.role === 'project_manager') {
      // Project managers see tasks in projects they manage
      const managerProjects = await db.collection<ProjectDocument>('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      
      const projectIds = managerProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    }

    // Aggregation pipeline to get task with full details
    const pipeline = [
      { $match: accessFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assignedTo',
          pipeline: [{ $project: { password: 0 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
          pipeline: [{ $project: { password: 0 } }]
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
          pipeline: [{ $project: { title: 1, client: 1, manager: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'dependencies',
          foreignField: '_id',
          as: 'dependencyTasks',
          pipeline: [{ $project: { title: 1, status: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.authorId',
          foreignField: '_id',
          as: 'commentAuthors',
          pipeline: [{ $project: { name: 1, avatar: 1 } }]
        }
      },
      {
        $addFields: {
          assignedTo: { $arrayElemAt: ['$assignedTo', 0] },
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          project: { $arrayElemAt: ['$project', 0] }
        }
      }
    ];

    const taskResult = await db.collection<TaskDocument>('tasks').aggregate<TaskAggregationResult>(pipeline).toArray();
    
    if (taskResult.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    const task = taskResult[0];

    // Transform for client
    const transformedTask = {
      ...task,
      _id: task._id.toString(),
      projectId: task.projectId?.toString(),
      assignedTo: task.assignedTo ? {
        ...task.assignedTo,
        _id: task.assignedTo._id.toString()
      } : null,
      createdBy: task.createdBy ? {
        ...task.createdBy,
        _id: task.createdBy._id.toString()
      } : null,
      project: task.project ? {
        ...task.project,
        _id: task.project._id.toString()
      } : null,
      dependencies: task.dependencies.map((dep: ObjectId) => dep.toString()),
      dependencyTasks: task.dependencyTasks?.map((dep: Pick<TaskDocument, '_id' | 'title' | 'status'>) => ({
        ...dep,
        _id: dep._id.toString()
      })) || [],
      comments: task.comments?.map((comment) => {
        const author = task.commentAuthors?.find((a: UserDocument) => 
          a._id.toString() === comment.authorId.toString()
        );
        return {
          ...comment,
          _id: comment._id.toString(),
          authorId: comment.authorId.toString(),
          author: author ? {
            ...author,
            _id: author._id.toString()
          } : null,
          createdAt: comment.createdAt.toISOString()
        };
      }) || [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      deadline: task.deadline?.toISOString(),
      startDate: task.startDate?.toISOString(),
      completedAt: task.completedAt?.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: transformedTask
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

// Update document interface
interface UpdateTaskDocument {
  updatedAt: Date;
  title?: string;
  description?: string;
  status?: string;
  completedAt?: Date;
  progress?: number;
  startDate?: Date;
  priority?: string;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  dependencies?: ObjectId[];
}

// PUT /api/tasks/[id] - Update task
export async function PUT(
  request: NextRequest,
  { params }: TaskDetailPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid task ID' 
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate input
    const validation = updateTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const data = validation.data;
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get current task to check permissions
    const currentTask = await db.collection<TaskDocument>('tasks').findOne({ _id: new ObjectId(id) });
    
    if (!currentTask) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Check if user has permission to update this task
    const project = await db.collection<ProjectDocument>('projects').findOne({ _id: currentTask.projectId });
    
    const canUpdate = session.user.role === 'super_admin' ||
                     (session.user.role === 'project_manager' && project?.manager?.equals(userId)) ||
                     (currentTask.assignedTo && currentTask.assignedTo.equals(userId));

    if (!canUpdate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Build update object - FIXED: Use proper interface instead of any
    const updateDoc: UpdateTaskDocument = {
      updatedAt: new Date()
    };

    if (data.title) updateDoc.title = data.title;
    if (data.description) updateDoc.description = data.description;
    if (data.status) {
      updateDoc.status = data.status;
      if (data.status === 'completed') {
        updateDoc.completedAt = new Date();
        updateDoc.progress = 100;
      } else if (data.status === 'in_progress' && !currentTask.startDate) {
        updateDoc.startDate = new Date();
      }
    }
    if (data.priority) updateDoc.priority = data.priority;
    if (data.deadline) updateDoc.deadline = new Date(data.deadline);
    if (data.estimatedHours !== undefined) updateDoc.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updateDoc.actualHours = data.actualHours;
    if (data.dependencies) updateDoc.dependencies = data.dependencies.map((dep: string) => new ObjectId(dep));

    // Update task
    const result = await db.collection<TaskDocument>('tasks').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Send notification if task was completed
    if (data.status === 'completed' && currentTask.status !== 'completed') {
      // Notify project manager and client
      const notificationPromises = [];
      
      if (project?.manager && !project.manager.equals(userId)) {
        notificationPromises.push(
          sendNotificationEmail({
            recipientId: project.manager.toString(),
            type: 'task_completed',
            projectId: currentTask.projectId.toString(),
            taskId: id,
            data: {
              taskTitle: currentTask.title,
              projectTitle: project.title,
              completedBy: session.user.name,
              completionDate: new Date().toLocaleDateString()
            }
          })
        );
      }

      if (project?.client && !project.client.equals(userId)) {
        notificationPromises.push(
          sendNotificationEmail({
            recipientId: project.client.toString(),
            type: 'task_completed',
            projectId: currentTask.projectId.toString(),
            taskId: id,
            data: {
              taskTitle: currentTask.title,
              projectTitle: project.title,
              completedBy: session.user.name,
              completionDate: new Date().toLocaleDateString()
            }
          })
        );
      }

      await Promise.allSettled(notificationPromises);
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Task updated successfully' }
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

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: TaskDetailPageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Only project managers and admins can delete tasks
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid task ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get task to check permissions
    const task = await db.collection<TaskDocument>('tasks').findOne({ _id: new ObjectId(id) });
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Check if user has permission to delete this task
    if (session.user.role === 'project_manager') {
      const project = await db.collection<ProjectDocument>('projects').findOne({ 
        _id: task.projectId,
        manager: userId 
      });
      
      if (!project) {
        return NextResponse.json({ 
          success: false, 
          error: 'Insufficient permissions' 
        }, { status: 403 });
      }
    }

    // Check if task has dependencies
    const dependentTasks = await db.collection<TaskDocument>('tasks').find({
      dependencies: new ObjectId(id)
    }).toArray();

    if (dependentTasks.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete task with dependent tasks. Please remove dependencies first.',
        dependentTasks: dependentTasks.map(t => ({
          _id: t._id.toString(),
          title: t.title
        }))
      }, { status: 400 });
    }

    // Delete task
    const result = await db.collection<TaskDocument>('tasks').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Task deleted successfully' }
    });

  } catch (error: unknown) {
    console.error('Error deleting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}