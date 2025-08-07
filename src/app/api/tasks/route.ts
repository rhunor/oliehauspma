// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createTaskSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';

interface TaskFilter {
  projectId?: { $in: ObjectId[] };
  assignee?: ObjectId;
  status?: string;
  priority?: string;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
}

// Define project document interface for better type safety
// interface ProjectDocument {
//   _id: ObjectId;
//   tasks: ObjectId[];
//   updatedAt: Date;
//   // Add other fields as needed
//   [key: string]: unknown;
// }

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const projectId = searchParams.get('projectId');
    const search = searchParams.get('search') || '';

    const { db } = await connectToDatabase();
    
    // Build filter based on user role
    const filter: TaskFilter = {};
    
    // Get user's accessible projects
    let userProjectIds: ObjectId[] = [];
    
    if (session.user.role === 'client') {
      const userProjects = await db.collection('projects')
        .find({ client: new ObjectId(session.user.id) }, { projection: { _id: 1 } })
        .toArray();
      userProjectIds = userProjects.map(p => p._id);
    } else if (session.user.role === 'project_manager') {
      const userProjects = await db.collection('projects')
        .find({ manager: new ObjectId(session.user.id) }, { projection: { _id: 1 } })
        .toArray();
      userProjectIds = userProjects.map(p => p._id);
    } else if (session.user.role === 'super_admin') {
      // Super admin can see all tasks - no filter needed
    }

    // Apply project filter for non-super-admin users
    if (session.user.role !== 'super_admin') {
      filter.projectId = { $in: userProjectIds };
    }

    // Apply specific project filter if requested
    if (projectId && ObjectId.isValid(projectId)) {
      const specificProjectId = new ObjectId(projectId);
      if (session.user.role !== 'super_admin') {
        // Ensure user has access to this specific project
        if (!userProjectIds.some(id => id.equals(specificProjectId))) {
          return NextResponse.json(
            { error: 'Access denied to this project' },
            { status: 403 }
          );
        }
      }
      filter.projectId = { $in: [specificProjectId] };
    }

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await db.collection('tasks').countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Get tasks with populated data
    const tasks = await db.collection('tasks')
      .aggregate([
        { $match: filter },
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
        { $unset: ['projectData', 'assigneeData', 'creatorData'] },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = createTaskSchema.safeParse(body);
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

    const taskData = validation.data;
    const { db } = await connectToDatabase();

    // Verify project exists and user has access
    const project = await db.collection('projects').findOne({ 
      _id: new ObjectId(taskData.projectId)
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 400 }
      );
    }

    // Check permission to create tasks in this project
    const canCreateTask = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && project.manager.toString() === session.user.id);

    if (!canCreateTask) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify assignee exists
    const assignee = await db.collection('users').findOne({ 
      _id: new ObjectId(taskData.assigneeId),
      isActive: true 
    });

    if (!assignee) {
      return NextResponse.json(
        { error: 'Assignee not found or inactive' },
        { status: 400 }
      );
    }

    // Create task document
    const newTask = {
      title: taskData.title,
      description: taskData.description,
      projectId: new ObjectId(taskData.projectId),
      assignee: new ObjectId(taskData.assigneeId),
      status: 'pending',
      priority: taskData.priority || 'medium',
      deadline: new Date(taskData.deadline),
      estimatedHours: taskData.estimatedHours,
      actualHours: 0,
      dependencies: taskData.dependencies?.map(id => new ObjectId(id)) || [],
      attachments: [],
      comments: [],
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('tasks').insertOne(newTask);

    // Use proper MongoDB update operation without 'any' type
    await db.collection('projects').updateOne(
      { _id: new ObjectId(taskData.projectId) },
      { 
        $push: { tasks: result.insertedId },
        $set: { updatedAt: new Date() }
      } as Record<string, unknown>
    );

    // Alternative Solution 2: If the above doesn't work, use this approach:
    // await db.collection('projects').updateOne(
    //   { _id: new ObjectId(taskData.projectId) },
    //   { 
    //     $push: { tasks: result.insertedId } as unknown as PushOperator<Document>,
    //     $set: { updatedAt: new Date() }
    //   }
    // );

    // Create notification for assignee
    await db.collection('notifications').insertOne({
      recipient: new ObjectId(taskData.assigneeId),
      sender: new ObjectId(session.user.id),
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${taskData.title}`,
      data: {
        taskId: result.insertedId,
        projectId: new ObjectId(taskData.projectId)
      },
      isRead: false,
      createdAt: new Date(),
    });

    // Return created task with populated data
    const createdTasks = await db.collection('tasks')
      .aggregate([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1 } }]
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
      data: createdTasks[0],
      message: 'Task created successfully',
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}