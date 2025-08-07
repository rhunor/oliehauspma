// src/app/api/analytics/dashboard/route.ts
import {  NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();

    // Build base filter based on user role
    const projectFilter: Record<string, unknown> = {};
    const taskFilter: Record<string, unknown> = {};

    if (session.user.role === 'client') {
      projectFilter.client = new ObjectId(session.user.id);
      taskFilter.projectId = { $in: [] }; // Will be populated with user's project IDs
    } else if (session.user.role === 'project_manager') {
      projectFilter.manager = new ObjectId(session.user.id);
      taskFilter.projectId = { $in: [] }; // Will be populated with user's project IDs
    }

    // Get user's project IDs if not super admin
    let userProjectIds: ObjectId[] = [];
    if (session.user.role !== 'super_admin') {
      const userProjects = await db.collection('projects')
        .find(projectFilter, { projection: { _id: 1 } })
        .toArray();
      userProjectIds = userProjects.map(p => p._id);
      taskFilter.projectId = { $in: userProjectIds };
    }

    // Run all analytics queries in parallel
    const [
      projectStats,
      taskStats,
      userStats,
      recentActivity,
      performanceMetrics
    ] = await Promise.all([
      // Project Statistics
      db.collection('projects').aggregate([
        { $match: projectFilter },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            activeProjects: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['planning', 'in_progress']] },
                  1,
                  0
                ]
              }
            },
            completedProjects: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
              }
            },
            onHoldProjects: {
              $sum: {
                $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0]
              }
            },
            averageProgress: { $avg: '$progress' },
            totalBudget: { $sum: '$budget' }
          }
        }
      ]).toArray(),

      // Task Statistics
      db.collection('tasks').aggregate([
        { $match: taskFilter },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
              }
            },
            pendingTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
              }
            },
            inProgressTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0]
              }
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'completed'] },
                      { $lt: ['$deadline', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // User Statistics (Super admin only)
      session.user.role === 'super_admin' ? 
        db.collection('users').aggregate([
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              activeUsers: {
                $sum: {
                  $cond: [{ $eq: ['$isActive', true] }, 1, 0]
                }
              },
              superAdmins: {
                $sum: {
                  $cond: [{ $eq: ['$role', 'super_admin'] }, 1, 0]
                }
              },
              projectManagers: {
                $sum: {
                  $cond: [{ $eq: ['$role', 'project_manager'] }, 1, 0]
                }
              },
              clients: {
                $sum: {
                  $cond: [{ $eq: ['$role', 'client'] }, 1, 0]
                }
              }
            }
          }
        ]).toArray() : [{ 
          _id: null, 
          totalUsers: 0, 
          activeUsers: 0,
          superAdmins: 0,
          projectManagers: 0,
          clients: 0
        }],

      // Recent Activity
      db.collection('projects').aggregate([
        { $match: projectFilter },
        { $sort: { updatedAt: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { name: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { name: 1 } }]
          }
        },
        {
          $project: {
            title: 1,
            status: 1,
            progress: 1,
            updatedAt: 1,
            client: { $arrayElemAt: ['$clientData.name', 0] },
            manager: { $arrayElemAt: ['$managerData.name', 0] }
          }
        }
      ]).toArray(),

      // Performance Metrics
      db.collection('projects').aggregate([
        { $match: { ...projectFilter, status: 'completed' } },
        {
          $group: {
            _id: null,
            averageCompletionTime: {
              $avg: {
                $divide: [
                  { $subtract: ['$updatedAt', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            },
            onTimeProjects: {
              $sum: {
                $cond: [
                  { $lte: ['$updatedAt', '$endDate'] },
                  1,
                  0
                ]
              }
            },
            totalCompletedProjects: { $sum: 1 }
          }
        }
      ]).toArray()
    ]);

    // Process results
    const projectData = projectStats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      onHoldProjects: 0,
      averageProgress: 0,
      totalBudget: 0
    };

    const taskData = taskStats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0
    };

    const userData = userStats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      superAdmins: 0,
      projectManagers: 0,
      clients: 0
    };

    const performanceData = performanceMetrics[0] || {
      averageCompletionTime: 0,
      onTimeProjects: 0,
      totalCompletedProjects: 0
    };

    // Calculate trends (mock for now - you can implement proper historical comparison)
    const trends = {
      projectGrowth: projectData.totalProjects > 0 ? 12 : 0,
      taskCompletion: taskData.totalTasks > 0 ? 8 : 0,
      userGrowth: userData.totalUsers > 0 ? 5 : 0,
      overdueIncrease: taskData.overdueTasks > 0 ? -3 : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        projects: {
          total: projectData.totalProjects,
          active: projectData.activeProjects,
          completed: projectData.completedProjects,
          onHold: projectData.onHoldProjects,
          averageProgress: Math.round(projectData.averageProgress || 0),
          totalBudget: projectData.totalBudget || 0,
          trend: trends.projectGrowth
        },
        tasks: {
          total: taskData.totalTasks,
          completed: taskData.completedTasks,
          pending: taskData.pendingTasks,
          inProgress: taskData.inProgressTasks,
          overdue: taskData.overdueTasks,
          completionRate: taskData.totalTasks > 0 
            ? Math.round((taskData.completedTasks / taskData.totalTasks) * 100) 
            : 0,
          trend: trends.taskCompletion
        },
        users: {
          total: userData.totalUsers,
          active: userData.activeUsers,
          superAdmins: userData.superAdmins,
          projectManagers: userData.projectManagers,
          clients: userData.clients,
          trend: trends.userGrowth
        },
        performance: {
          averageCompletionTime: Math.round(performanceData.averageCompletionTime || 0),
          onTimePercentage: performanceData.totalCompletedProjects > 0 
            ? Math.round((performanceData.onTimeProjects / performanceData.totalCompletedProjects) * 100)
            : 0,
          overdueTasksTrend: trends.overdueIncrease
        },
        recentActivity: recentActivity.map(project => ({
          id: project._id,
          type: 'project_updated',
          title: project.title,
          status: project.status,
          progress: project.progress,
          client: project.client,
          manager: project.manager,
          timestamp: project.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}