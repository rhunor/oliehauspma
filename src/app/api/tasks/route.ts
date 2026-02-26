// src/app/api/tasks/route.ts - Final Fixed Version with Proper MongoDB Types
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createTaskSchema } from '@/lib/validation';
import { ObjectId, Filter } from 'mongodb';
import { sendNotificationEmail } from '@/lib/email';

// Define clean task interface without extending Document
interface TaskData {
  _id?: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignedTo?: ObjectId;
  createdBy: ObjectId;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: ObjectId[];
  tags: string[];
  attachments: Array<{
    name: string;
    url: string;
    uploadedAt: Date;
  }>;
  comments: Array<{
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

// Type for database insertion (without _id)
interface TaskInsertData {
  title: string;
  description: string;
  projectId: ObjectId;
  assignedTo?: ObjectId;
  createdBy: ObjectId;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: ObjectId[];
  tags: string[];
  attachments: Array<{
    name: string;
    url: string;
    uploadedAt: Date;
  }>;
  comments: Array<{
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

// Project and User document interfaces
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
  isActive: boolean;
}

// Aggregation result interface - FIXED: Don't extend TaskData since types are different after $lookup
interface TaskAggregationResult {
  _id?: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignedTo?: UserDocument; // Different type after $lookup
  createdBy?: UserDocument; // Different type after $lookup
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  progress: number;
  dependencies: ObjectId[];
  tags: string[];
  attachments: Array<{
    name: string;
    url: string;
    uploadedAt: Date;
  }>;
  comments: Array<{
    _id: ObjectId;
    content: string;
    authorId: ObjectId;
    createdAt: Date;
    isInternal: boolean;
  }>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  project?: Pick<ProjectDocument, '_id' | 'title'>;
}

// Define MongoDB filter interface to avoid type conflicts
interface TaskFilterQuery {
  projectId?: ObjectId | { $in: ObjectId[] };
  assignedTo?: ObjectId;
  status?: TaskData['status'] | { $nin: string[] };
  priority?: TaskData['priority'];
  deadline?: { $lt: Date };
  _id?: ObjectId;
  $or?: TaskFilterQuery[];
  $and?: TaskFilterQuery[];
}

// GET /api/tasks - Retrieve tasks with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const overdue = searchParams.get('overdue') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Build access filter based on user role using proper typing - FIXED: Use const instead of let
    const accessFilter: TaskFilterQuery = {};
    
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
    // Super admins can see all tasks (no additional filter)

    // Build query filter using our custom interface
    const queryFilter: TaskFilterQuery = { ...accessFilter };

    if (projectId && ObjectId.isValid(projectId)) {
      queryFilter.projectId = new ObjectId(projectId);
    }

    if (assignedTo && ObjectId.isValid(assignedTo)) {
      queryFilter.assignedTo = new ObjectId(assignedTo);
    }

    if (status) {
      queryFilter.status = status as TaskData['status'];
    }

    if (priority) {
      queryFilter.priority = priority as TaskData['priority'];
    }

    if (overdue) {
      queryFilter.deadline = { $lt: new Date() };
      queryFilter.status = { $nin: ['completed'] };
    }

    // Cast to Filter<TaskData> for MongoDB aggregation - FIXED: Use proper Filter type instead of any
    const mongoFilter = queryFilter as Filter<TaskData>;

    // Aggregation pipeline to get tasks with user and project details
    const pipeline = [
      { $match: mongoFilter },
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
          pipeline: [{ $project: { title: 1 } }]
        }
      },
      {
        $addFields: {
          assignedTo: { $arrayElemAt: ['$assignedTo', 0] },
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          project: { $arrayElemAt: ['$project', 0] }
        }
      },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    const tasks = await db.collection<TaskData>('tasks').aggregate<TaskAggregationResult>(pipeline).toArray();

    // Get total count for pagination using the same filter
    const totalTasks = await db.collection<TaskData>('tasks').countDocuments(mongoFilter);

    // Transform for client
    const transformedTasks = tasks.map(task => ({
      ...task,
      _id: task._id?.toString(),
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
      dependencies: task.dependencies?.map((dep: ObjectId) => dep.toString()) || [],
      comments: task.comments?.map((comment) => ({
        ...comment,
        _id: comment._id.toString(),
        authorId: comment.authorId.toString()
      })) || [],
      createdAt: task.createdAt?.toISOString(),
      updatedAt: task.updatedAt?.toISOString(),
      deadline: task.deadline?.toISOString(),
      startDate: task.startDate?.toISOString(),
      completedAt: task.completedAt?.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        tasks: transformedTasks,
        pagination: {
          page,
          limit,
          total: totalTasks,
          pages: Math.ceil(totalTasks / limit),
          hasNext: page < Math.ceil(totalTasks / limit),
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

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Only project managers and admins can create tasks
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const validation = createTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const data = validation.data;
    const { db } = await connectToDatabase();

    // Verify project exists and user has access
    const project = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(data.projectId),
      ...(session.user.role === 'project_manager' 
        ? { manager: new ObjectId(session.user.id) } 
        : {})
    });

    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Verify assignee exists if provided
    if (data.assigneeId) {
      const assignee = await db.collection<UserDocument>('users').findOne({
        _id: new ObjectId(data.assigneeId),
        isActive: true
      });

      if (!assignee) {
        return NextResponse.json({ 
          success: false, 
          error: 'Assignee not found' 
        }, { status: 404 });
      }
    }

    // Create task document with proper typing - FIXED
    const taskDoc: TaskInsertData = {
      title: data.title,
      description: data.description,
      projectId: new ObjectId(data.projectId),
      assignedTo: data.assigneeId ? new ObjectId(data.assigneeId) : undefined,
      createdBy: new ObjectId(session.user.id),
      status: 'pending',
      priority: data.priority,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      estimatedHours: data.estimatedHours,
      progress: 0,
      dependencies: (data.dependencies || []).map((dep: string) => new ObjectId(dep)),
      tags: data.tags || [],
      attachments: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert the task - this should work now
    const result = await db.collection<TaskData>('tasks').insertOne(taskDoc);

    // Send notification email to assignee
    if (data.assigneeId) {
      await sendNotificationEmail({
        recipientId: data.assigneeId,
        type: 'task_assigned',
        projectId: data.projectId,
        taskId: result.insertedId.toString(),
        data: {
          taskTitle: data.title,
          taskDescription: data.description,
          projectTitle: project.title,
          dueDate: data.deadline ? new Date(data.deadline).toLocaleDateString() : 'No deadline',
          priority: data.priority,
          taskUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/tasks/${result.insertedId}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.insertedId.toString(),
        message: 'Task created successfully'
      }
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