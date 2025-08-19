// src/app/api/tasks/route.ts - Fixed TypeScript Issues
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface TaskDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: ObjectId;
  assignedBy: ObjectId;
  dueDate?: Date;
  startDate?: Date;
  completedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  tags: string[];
  dependencies: ObjectId[];
  isRecurring: boolean;
  parentTaskId?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/tasks - Retrieve tasks with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');
    const dueDateFrom = searchParams.get('dueDateFrom');
    const dueDateTo = searchParams.get('dueDateTo');
    const search = searchParams.get('search');
    const myTasks = searchParams.get('myTasks') === 'true';
    const overdue = searchParams.get('overdue') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const { db } = await connectToDatabase();

    // Build base query with proper typing
    interface TaskQuery {
      projectId?: ObjectId | { $in: ObjectId[] };
      status?: string | { $nin: string[] };
      priority?: string;
      assigneeId?: ObjectId;
      dueDate?: {
        $gte?: Date;
        $lte?: Date;
        $lt?: Date;
      };
      $or?: Array<{
        title?: { $regex: string; $options: string };
        description?: { $regex: string; $options: string };
        tags?: { $elemMatch: { $regex: string; $options: string } };
      }>;
    }

    const baseQuery: TaskQuery = {};

    if (projectId) {
      // Verify user has access to the project
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
        $or: [
          { client: new ObjectId(session.user.id) },
          { manager: new ObjectId(session.user.id) }
        ]
      });

      if (!project && session.user.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: 'Access denied to project tasks'
        }, { status: 403 });
      }

      baseQuery.projectId = new ObjectId(projectId);
    } else {
      // Get all accessible projects
      const projectQuery = session.user.role === 'super_admin' 
        ? {} 
        : session.user.role === 'project_manager'
        ? { manager: new ObjectId(session.user.id) }
        : { client: new ObjectId(session.user.id) };

      const projects = await db.collection('projects').find(projectQuery, { projection: { _id: 1 } }).toArray();
      const projectIds = projects.map(p => p._id);
      
      baseQuery.projectId = { $in: projectIds };
    }

    // Add filters with proper typing
    if (status) {
      baseQuery.status = status;
    }

    if (priority) {
      baseQuery.priority = priority;
    }

    if (assigneeId) {
      baseQuery.assigneeId = new ObjectId(assigneeId);
    }

    if (myTasks) {
      baseQuery.assigneeId = new ObjectId(session.user.id);
    }

    if (dueDateFrom || dueDateTo) {
      baseQuery.dueDate = {};
      if (dueDateFrom) {
        baseQuery.dueDate.$gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        baseQuery.dueDate.$lte = new Date(dueDateTo);
      }
    }

    if (overdue) {
      baseQuery.dueDate = { $lt: new Date() };
      baseQuery.status = { $nin: ['completed', 'cancelled'] };
    }

    if (search) {
      baseQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    // Get tasks with populated fields
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const tasks = await db.collection('tasks')
      .aggregate([
        { $match: baseQuery },
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
            as: 'project',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            assignee: { $arrayElemAt: ['$assignee', 0] },
            creator: { $arrayElemAt: ['$creator', 0] },
            project: { $arrayElemAt: ['$project', 0] }
          }
        },
        { $sort: { [sortBy]: sortDirection } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    // Get total count for pagination
    const total = await db.collection('tasks').countDocuments(baseQuery);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json() as {
      projectId: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assigneeId?: string;
      dueDate?: string;
      startDate?: string;
      estimatedHours?: number;
      tags?: string[];
      dependencies?: string[];
      isRecurring?: boolean;
      parentTaskId?: string;
    };

    const {
      projectId,
      title,
      description,
      priority = 'medium',
      assigneeId,
      dueDate,
      startDate,
      estimatedHours,
      tags = [],
      dependencies = [],
      isRecurring = false,
      parentTaskId
    } = body;

    if (!projectId || !title?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Project ID and title are required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify user has permission to create tasks in this project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { manager: new ObjectId(session.user.id) },
        ...(session.user.role === 'super_admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Access denied or project not found'
      }, { status: 403 });
    }

    // Create task document
    const taskData: TaskDocument = {
      projectId: new ObjectId(projectId),
      title: title.trim(),
      description: description?.trim(),
      status: 'pending',
      priority,
      assigneeId: assigneeId ? new ObjectId(assigneeId) : undefined,
      assignedBy: new ObjectId(session.user.id),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      estimatedHours,
      actualHours: 0,
      progress: 0,
      tags: Array.isArray(tags) ? tags : [],
      dependencies: dependencies.map((id: string) => new ObjectId(id)),
      isRecurring,
      parentTaskId: parentTaskId ? new ObjectId(parentTaskId) : undefined,
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('tasks').insertOne(taskData);

    return NextResponse.json({
      success: true,
      data: { ...taskData, _id: result.insertedId },
      message: 'Task created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}