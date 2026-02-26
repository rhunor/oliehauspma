// src/app/api/pending-tasks/route.ts - COMPLETE ENHANCED PENDING TASKS API
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// TypeScript interfaces for type safety
interface PendingTaskResponse {
  _id: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  estimatedDuration?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  projectTitle: string;
  status: 'pending' | 'in_progress';
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  dependencies: string[];
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
  blockers?: string[];
  estimatedStartDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingTasksStats {
  totalPending: number;
  urgent: number;
  highPriority: number;
  dueSoon: number; // Next 7 days
  overdue: number;
  inProgress: number;
  byCategory: Record<string, number>;
  byProject: Array<{
    projectId: string;
    projectTitle: string;
    pendingCount: number;
    urgentCount: number;
  }>;
  blockedTasks: number;
  upcomingDeadlines: Array<{
    _id: string;
    title: string;
    scheduledDate: string;
    projectTitle: string;
    priority: string;
  }>;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: string;
  scheduledDate?: string;
  estimatedDuration?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dependencies?: string[];
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  estimatedStartDate?: string;
}

// GET pending tasks with advanced filtering and statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const projectId = searchParams.get('projectId');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const dueSoon = searchParams.get('dueSoon') === 'true';
    const blocked = searchParams.get('blocked') === 'true';
    const assignedTo = searchParams.get('assignedTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeStats = searchParams.get('includeStats') === 'true';
    const userRole = session.user.role;
    const userId = session.user.id;

    // Build base filter based on user role
    const baseFilter: Record<string, unknown> = {
      status: { $in: ['pending', 'in_progress'] }
    };

    // Role-based filtering
    let allowedProjectIds: ObjectId[] = [];

    if (userRole === 'client') {
      const clientProjects = await db.collection('projects')
        .find({ client: new ObjectId(userId) })
        .project({ _id: 1 })
        .toArray();
      allowedProjectIds = clientProjects.map(p => p._id);
    } else if (userRole === 'project_manager') {
      const managerProjects = await db.collection('projects')
        .find({ manager: new ObjectId(userId) })
        .project({ _id: 1 })
        .toArray();
      allowedProjectIds = managerProjects.map(p => p._id);
    } else {
      // Super admin can see all
      const allProjects = await db.collection('projects')
        .find({})
        .project({ _id: 1 })
        .toArray();
      allowedProjectIds = allProjects.map(p => p._id);
    }

    baseFilter.projectId = { $in: allowedProjectIds };

    // Add filters based on query parameters
    if (projectId && ObjectId.isValid(projectId)) {
      baseFilter.projectId = new ObjectId(projectId);
    }

    if (priority) {
      baseFilter.priority = priority;
    }

    if (category) {
      baseFilter.category = category;
    }

    if (assignedTo && ObjectId.isValid(assignedTo)) {
      baseFilter.assignedTo = new ObjectId(assignedTo);
    }

    if (blocked) {
      baseFilter.blockers = { $exists: true, $ne: [], $not: { $size: 0 } };
    }

    // Due soon filter (next 7 days)
    if (dueSoon) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      baseFilter.scheduledDate = {
        $exists: true,
        $ne: null,
        $lte: nextWeek
      };
    }

    // Execute aggregation pipeline for enhanced data
    const pipeline = [
      { $match: baseFilter },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectData',
          pipeline: [{ $project: { title: 1, status: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assigneeData',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$projectData', 0] },
          assignee: { $arrayElemAt: ['$assigneeData', 0] },
          // Custom sort for priority (urgent first)
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'urgent'] }, then: 1 },
                { case: { $eq: ['$priority', 'high'] }, then: 2 },
                { case: { $eq: ['$priority', 'medium'] }, then: 3 },
                { case: { $eq: ['$priority', 'low'] }, then: 4 }
              ],
              default: 5
            }
          }
        }
      },
      { 
        $sort: { 
          priorityOrder: 1,
          scheduledDate: 1,
          createdAt: 1 
        } 
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $unset: ['projectData', 'assigneeData', 'priorityOrder'] }
    ];

    const tasks = await db.collection('tasks').aggregate(pipeline).toArray();

    // Get total count for pagination
    const totalCount = await db.collection('tasks').countDocuments(baseFilter);

    // Transform data for client consumption
    const transformedTasks: PendingTaskResponse[] = tasks.map(task => ({
      _id: task._id.toString(),
      title: task.title,
      description: task.description,
      scheduledDate: task.scheduledDate?.toISOString(),
      estimatedDuration: task.estimatedDuration,
      priority: task.priority || 'medium',
      projectId: task.projectId.toString(),
      projectTitle: task.project?.title || 'Unknown Project',
      status: task.status,
      assignedTo: task.assignee ? {
        _id: task.assignee._id.toString(),
        name: task.assignee.name,
        email: task.assignee.email
      } : undefined,
      dependencies: (task.dependencies || []).map((dep: ObjectId) => dep.toString()),
      category: task.category || 'other',
      progress: task.progress || 0,
      blockers: task.blockers || [],
      estimatedStartDate: task.estimatedStartDate?.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    }));

    let stats: PendingTasksStats | undefined;

    // Generate statistics if requested
    if (includeStats) {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get all pending tasks for stats
      const allPendingTasks = await db.collection('tasks')
        .find({
          projectId: { $in: allowedProjectIds },
          status: { $in: ['pending', 'in_progress'] }
        })
        .toArray();

      // Calculate basic stats
      const urgentTasks = allPendingTasks.filter(task => task.priority === 'urgent');
      const highPriorityTasks = allPendingTasks.filter(task => task.priority === 'high');
      const dueSoonTasks = allPendingTasks.filter(task => 
        task.scheduledDate && task.scheduledDate <= nextWeek && task.scheduledDate >= now
      );
      const overdueTasks = allPendingTasks.filter(task => 
        task.scheduledDate && task.scheduledDate < now
      );
      const inProgressTasks = allPendingTasks.filter(task => task.status === 'in_progress');
      const blockedTasks = allPendingTasks.filter(task => 
        task.blockers && task.blockers.length > 0
      );

      // Category breakdown
      const categoryStats = allPendingTasks.reduce((acc, task) => {
        const category = task.category || 'other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Project breakdown
      const projectStats = await db.collection('projects')
        .aggregate([
          { $match: { _id: { $in: allowedProjectIds } } },
          {
            $lookup: {
              from: 'tasks',
              let: { projectId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$projectId', '$$projectId'] },
                    status: { $in: ['pending', 'in_progress'] }
                  }
                }
              ],
              as: 'pendingTasks'
            }
          },
          {
            $lookup: {
              from: 'tasks',
              let: { projectId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$projectId', '$$projectId'] },
                    status: { $in: ['pending', 'in_progress'] },
                    priority: 'urgent'
                  }
                }
              ],
              as: 'urgentTasks'
            }
          },
          {
            $project: {
              title: 1,
              pendingCount: { $size: '$pendingTasks' },
              urgentCount: { $size: '$urgentTasks' }
            }
          },
          { $match: { pendingCount: { $gt: 0 } } },
          { $sort: { urgentCount: -1, pendingCount: -1 } }
        ])
        .toArray();

      // Upcoming deadlines (next 14 days)
      const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const upcomingDeadlines = await db.collection('tasks')
        .aggregate([
          {
            $match: {
              projectId: { $in: allowedProjectIds },
              status: { $in: ['pending', 'in_progress'] },
              scheduledDate: {
                $exists: true,
                $ne: null,
                $gte: now,
                $lte: fourteenDaysFromNow
              }
            }
          },
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
            $addFields: {
              project: { $arrayElemAt: ['$projectData', 0] }
            }
          },
          {
            $project: {
              title: 1,
              scheduledDate: 1,
              priority: 1,
              projectTitle: '$project.title'
            }
          },
          { $sort: { scheduledDate: 1 } },
          { $limit: 10 }
        ])
        .toArray();

      stats = {
        totalPending: allPendingTasks.length,
        urgent: urgentTasks.length,
        highPriority: highPriorityTasks.length,
        dueSoon: dueSoonTasks.length,
        overdue: overdueTasks.length,
        inProgress: inProgressTasks.length,
        byCategory: categoryStats,
        byProject: projectStats.map(project => ({
          projectId: project._id.toString(),
          projectTitle: project.title,
          pendingCount: project.pendingCount,
          urgentCount: project.urgentCount
        })),
        blockedTasks: blockedTasks.length,
        upcomingDeadlines: upcomingDeadlines.map(task => ({
          _id: task._id.toString(),
          title: task.title,
          scheduledDate: task.scheduledDate.toISOString(),
          projectTitle: task.projectTitle || 'Unknown Project',
          priority: task.priority || 'medium'
        }))
      };
    }

    const response: {
      success: boolean;
      data: {
        tasks: PendingTaskResponse[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
        stats?: PendingTasksStats;
      };
    } = {
      success: true,
      data: {
        tasks: transformedTasks,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    };

    if (stats) {
      response.data.stats = stats;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new task - for project managers and admins
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can create tasks" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const body = await request.json() as CreateTaskRequest;
    
    // Validate required fields
    if (!body.title || !body.projectId) {
      return NextResponse.json(
        { error: "Title and project ID are required" },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const project = await db.collection('projects')
      .findOne({ _id: new ObjectId(body.projectId) });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager' && 
        project.manager.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to create tasks for this project" },
        { status: 403 }
      );
    }

    // Validate assigned user if provided
    if (body.assignedTo) {
      const assignedUser = await db.collection('users')
        .findOne({ _id: new ObjectId(body.assignedTo) });
      
      if (!assignedUser) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 404 }
        );
      }
    }

    // Validate dependencies if provided
    if (body.dependencies && body.dependencies.length > 0) {
      const dependencyIds = body.dependencies.map(dep => new ObjectId(dep));
      const existingDeps = await db.collection('tasks')
        .find({ _id: { $in: dependencyIds } })
        .toArray();
      
      if (existingDeps.length !== body.dependencies.length) {
        return NextResponse.json(
          { error: "One or more dependency tasks not found" },
          { status: 400 }
        );
      }
    }

    const currentDate = new Date();

    // Create new task
    const newTask = {
      title: body.title,
      description: body.description,
      projectId: new ObjectId(body.projectId),
      status: 'pending' as const,
      priority: body.priority || 'medium' as const,
      category: body.category || 'other' as const,
      progress: 0,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
      estimatedStartDate: body.estimatedStartDate ? new Date(body.estimatedStartDate) : undefined,
      estimatedDuration: body.estimatedDuration,
      assignedTo: body.assignedTo ? new ObjectId(body.assignedTo) : undefined,
      dependencies: body.dependencies ? body.dependencies.map(dep => new ObjectId(dep)) : [],
      blockers: [],
      createdBy: new ObjectId(session.user.id),
      createdAt: currentDate,
      updatedAt: currentDate
    };

    const result = await db.collection('tasks').insertOne(newTask);

    // Fetch the created task with project and assignee details
    const createdTask = await db.collection('tasks')
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
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assigneeData',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] },
            assignee: { $arrayElemAt: ['$assigneeData', 0] }
          }
        }
      ])
      .toArray();

    const task = createdTask[0];

    return NextResponse.json({
      success: true,
      data: {
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        projectId: task.projectId.toString(),
        projectTitle: task.project?.title || 'Unknown Project',
        status: task.status,
        priority: task.priority,
        category: task.category,
        scheduledDate: task.scheduledDate?.toISOString(),
        estimatedDuration: task.estimatedDuration,
        assignedTo: task.assignee ? {
          _id: task.assignee._id.toString(),
          name: task.assignee.name,
          email: task.assignee.email
        } : undefined,
        dependencies: task.dependencies?.map((dep: ObjectId) => dep.toString()) || [],
        createdAt: task.createdAt.toISOString()
      },
      message: "Task created successfully"
    });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT update existing task
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can update tasks" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const body = await request.json();
    
    if (!body.taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Find existing task
    const existingTask = await db.collection('tasks')
      .findOne({ _id: new ObjectId(body.taskId) });

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: existingTask.projectId });
      
      if (!project || project.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to update this task" },
          { status: 403 }
        );
      }
    }

    // Validate assigned user if provided
    if (body.assignedTo && body.assignedTo !== existingTask.assignedTo?.toString()) {
      const assignedUser = await db.collection('users')
        .findOne({ _id: new ObjectId(body.assignedTo) });
      
      if (!assignedUser) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 404 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: new ObjectId(session.user.id)
    };

    // Only update provided fields
    const allowedFields = [
      'title', 'description', 'priority', 'category', 'scheduledDate',
      'estimatedStartDate', 'estimatedDuration', 'assignedTo', 'dependencies',
      'blockers', 'progress', 'status'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        if (field === 'scheduledDate' || field === 'estimatedStartDate') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (field === 'assignedTo') {
          updateData[field] = body[field] ? new ObjectId(body[field]) : null;
        } else if (field === 'dependencies') {
          updateData[field] = body[field] ? body[field].map((dep: string) => new ObjectId(dep)) : [];
        } else {
          updateData[field] = body[field];
        }
      }
    });

    await db.collection('tasks').updateOne(
      { _id: new ObjectId(body.taskId) },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: "Task updated successfully"
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE task
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only project managers and admins can delete tasks" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Find the task
    const task = await db.collection('tasks')
      .findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check authorization for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: task.projectId });
      
      if (!project || project.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to delete this task" },
          { status: 403 }
        );
      }
    }

    // Check if task has dependencies pointing to it
    const dependentTasks = await db.collection('tasks')
      .find({ dependencies: new ObjectId(taskId) })
      .toArray();

    if (dependentTasks.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete task with dependencies",
          details: `${dependentTasks.length} task(s) depend on this task`
        },
        { status: 400 }
      );
    }

    // Delete the task
    await db.collection('tasks').deleteOne({ _id: new ObjectId(taskId) });

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}