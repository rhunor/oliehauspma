// src/app/api/completed-tasks/route.ts - ENHANCED COMPLETED TASKS API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// TypeScript interfaces for type safety
interface CompletedTaskResponse {
  _id: string;
  title: string;
  description?: string;
  completedDate: string;
  projectId: string;
  projectTitle: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  completedBy: {
    _id: string;
    name: string;
    email: string;
  };
  estimatedDuration?: string;
  actualDuration?: string;
  quality?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement';
  photos?: string[];
  notes?: string;
  milestoneId?: string;
  milestoneName?: string;
}

interface CompletedTasksStats {
  totalCompleted: number;
  thisWeek: number;
  thisMonth: number;
  byCategory: Record<string, number>;
  byProject: Array<{
    projectId: string;
    projectTitle: string;
    completedCount: number;
    completionRate: number;
  }>;
  recentMilestones: Array<{
    _id: string;
    name: string;
    completedDate: string;
    projectTitle: string;
    tasksCount: number;
  }>;
}

// GET completed tasks with advanced filtering and statistics
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
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const quality = searchParams.get('quality');
    const milestone = searchParams.get('milestone');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeStats = searchParams.get('includeStats') === 'true';
    const userRole = session.user.role;
    const userId = session.user.id;

    // Build base filter based on user role
    const baseFilter: Record<string, unknown> = {
      status: 'completed',
      completedAt: { $exists: true, $ne: null }
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

    if (category) {
      baseFilter.category = category;
    }

    if (quality) {
      baseFilter.quality = quality;
    }

    if (milestone) {
      baseFilter.milestoneId = new ObjectId(milestone);
    }

    // Date filtering
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      baseFilter.completedAt = dateFilter;
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
          pipeline: [{ $project: { title: 1, status: 1, progress: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'completedBy',
          foreignField: '_id',
          as: 'completedByData',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'milestones',
          localField: 'milestoneId',
          foreignField: '_id',
          as: 'milestoneData',
          pipeline: [{ $project: { name: 1, description: 1 } }]
        }
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$projectData', 0] },
          completedByUser: { $arrayElemAt: ['$completedByData', 0] },
          milestone: { $arrayElemAt: ['$milestoneData', 0] }
        }
      },
      { $sort: { completedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $unset: ['projectData', 'completedByData', 'milestoneData'] }
    ];

    const tasks = await db.collection('tasks').aggregate(pipeline).toArray();

    // Get total count for pagination
    const totalCount = await db.collection('tasks').countDocuments(baseFilter);

    // Transform data for client consumption
    const transformedTasks: CompletedTaskResponse[] = tasks.map(task => ({
      _id: task._id.toString(),
      title: task.title,
      description: task.description,
      completedDate: task.completedAt.toISOString(),
      projectId: task.projectId.toString(),
      projectTitle: task.project?.title || 'Unknown Project',
      category: task.category || 'other',
      completedBy: {
        _id: task.completedByUser?._id?.toString() || '',
        name: task.completedByUser?.name || 'Unknown',
        email: task.completedByUser?.email || ''
      },
      estimatedDuration: task.estimatedDuration,
      actualDuration: task.actualDuration,
      quality: task.quality,
      photos: task.photos || [],
      notes: task.notes,
      milestoneId: task.milestoneId?.toString(),
      milestoneName: task.milestone?.name
    }));

    let stats: CompletedTasksStats | undefined;

    // Generate statistics if requested
    if (includeStats) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all completed tasks for stats
      const allCompletedTasks = await db.collection('tasks')
        .find({
          projectId: { $in: allowedProjectIds },
          status: 'completed',
          completedAt: { $exists: true, $ne: null }
        })
        .toArray();

      // Calculate basic stats
      const thisWeekTasks = allCompletedTasks.filter(task => 
        task.completedAt >= weekAgo
      );
      const thisMonthTasks = allCompletedTasks.filter(task => 
        task.completedAt >= monthAgo
      );

      // Category breakdown
      const categoryStats = allCompletedTasks.reduce((acc, task) => {
        const category = task.category || 'other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Project breakdown with completion rates
      const projectStats = await db.collection('projects')
        .aggregate([
          { $match: { _id: { $in: allowedProjectIds } } },
          {
            $lookup: {
              from: 'tasks',
              localField: '_id',
              foreignField: 'projectId',
              as: 'allTasks'
            }
          },
          {
            $lookup: {
              from: 'tasks',
              let: { projectId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$projectId', '$projectId'] },
                    status: 'completed',
                    completedAt: { $exists: true, $ne: null }
                  }
                }
              ],
              as: 'completedTasks'
            }
          },
          {
            $project: {
              title: 1,
              totalTasks: { $size: '$allTasks' },
              completedCount: { $size: '$completedTasks' },
              completionRate: {
                $cond: [
                  { $gt: [{ $size: '$allTasks' }, 0] },
                  {
                    $multiply: [
                      { $divide: [{ $size: '$completedTasks' }, { $size: '$allTasks' }] },
                      100
                    ]
                  },
                  0
                ]
              }
            }
          },
          { $sort: { completedCount: -1 } }
        ])
        .toArray();

      // Recent milestones
      const recentMilestones = await db.collection('milestones')
        .aggregate([
          {
            $match: {
              status: 'completed',
              completedAt: { $gte: monthAgo }
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
            $lookup: {
              from: 'tasks',
              localField: '_id',
              foreignField: 'milestoneId',
              as: 'tasks'
            }
          },
          {
            $addFields: {
              project: { $arrayElemAt: ['$projectData', 0] },
              tasksCount: { $size: '$tasks' }
            }
          },
          { $sort: { completedAt: -1 } },
          { $limit: 5 }
        ])
        .toArray();

      stats = {
        totalCompleted: allCompletedTasks.length,
        thisWeek: thisWeekTasks.length,
        thisMonth: thisMonthTasks.length,
        byCategory: categoryStats,
        byProject: projectStats.map(project => ({
          projectId: project._id.toString(),
          projectTitle: project.title,
          completedCount: project.completedCount,
          completionRate: Math.round(project.completionRate)
        })),
        recentMilestones: recentMilestones.map(milestone => ({
          _id: milestone._id.toString(),
          name: milestone.name,
          completedDate: milestone.completedAt.toISOString(),
          projectTitle: milestone.project?.title || 'Unknown Project',
          tasksCount: milestone.tasksCount
        }))
      };
    }

    const response: {
      success: boolean;
      data: {
        tasks: CompletedTaskResponse[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
        stats?: CompletedTasksStats;
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
    console.error('Error fetching completed tasks:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST mark task as completed - for project managers and admins
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
        { error: "Only project managers and admins can mark tasks as completed" },
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

    // Find the task
    const task = await db.collection('tasks')
      .findOne({ _id: new ObjectId(body.taskId) });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check if task is already completed
    if (task.status === 'completed') {
      return NextResponse.json(
        { error: "Task is already completed" },
        { status: 400 }
      );
    }

    // Verify project access for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: task.projectId });
      
      if (!project || project.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to complete tasks for this project" },
          { status: 403 }
        );
      }
    }

    const completedAt = new Date();
    const updateData = {
      status: 'completed',
      completedAt,
      completedBy: new ObjectId(session.user.id),
      updatedAt: completedAt,
      // Optional completion details from request body
      actualDuration: body.actualDuration,
      quality: body.quality,
      photos: body.photos || [],
      notes: body.notes
    };

    // Update the task
    await db.collection('tasks').updateOne(
      { _id: new ObjectId(body.taskId) },
      { $set: updateData }
    );

    // Check if this completes a milestone
    if (task.milestoneId) {
      const milestoneId = new ObjectId(task.milestoneId);
      
      // Get all tasks for this milestone
      const milestoneTasks = await db.collection('tasks')
        .find({ milestoneId }).toArray();
      
      // Check if all tasks are completed
      const completedTasks = milestoneTasks.filter(t => t.status === 'completed' || t._id.equals(task._id));
      
      if (completedTasks.length === milestoneTasks.length) {
        // Mark milestone as completed
        await db.collection('milestones').updateOne(
          { _id: milestoneId },
          {
            $set: {
              status: 'completed',
              completedAt,
              completedBy: new ObjectId(session.user.id),
              updatedAt: completedAt
            }
          }
        );
      }
    }

    // Update project progress if needed
    const projectTasks = await db.collection('tasks')
      .find({ projectId: task.projectId }).toArray();
    
    const projectCompletedTasks = projectTasks.filter(t => 
      t.status === 'completed' || t._id.equals(task._id)
    );
    
    const newProgress = Math.round((projectCompletedTasks.length / projectTasks.length) * 100);
    
    await db.collection('projects').updateOne(
      { _id: task.projectId },
      { 
        $set: { 
          progress: newProgress,
          updatedAt: completedAt
        } 
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        taskId: body.taskId,
        completedAt: completedAt.toISOString(),
        newProjectProgress: newProgress
      },
      message: "Task marked as completed successfully"
    });

  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT update completed task details
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
        { error: "Only project managers and admins can update completed tasks" },
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

    // Find the task
    const task = await db.collection('tasks')
      .findOne({ _id: new ObjectId(body.taskId) });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (task.status !== 'completed') {
      return NextResponse.json(
        { error: "Task is not completed" },
        { status: 400 }
      );
    }

    // Verify project access for project managers
    if (session.user.role === 'project_manager') {
      const project = await db.collection('projects')
        .findOne({ _id: task.projectId });
      
      if (!project || project.manager.toString() !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to update tasks for this project" },
          { status: 403 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: new ObjectId(session.user.id)
    };

    // Only update provided fields
    const allowedFields = ['actualDuration', 'quality', 'photos', 'notes', 'category'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    await db.collection('tasks').updateOne(
      { _id: new ObjectId(body.taskId) },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: "Completed task updated successfully"
    });

  } catch (error) {
    console.error('Error updating completed task:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}