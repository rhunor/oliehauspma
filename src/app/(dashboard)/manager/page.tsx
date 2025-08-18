// src/app/(dashboard)/manager/page.tsx - COMPLETE FIXED VERSION
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

import Link from 'next/link';
import { 
  FolderOpen, 
 
  Clock, 
  CheckCircle, 
  AlertTriangle,
 
  MessageSquare,
  FileText,
  TrendingUp,
  BarChart3,
  PlusCircle,
  ChevronRight,
  Activity,
 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Enhanced TypeScript interfaces for type safety
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  client: ObjectId;
  manager: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskDocument {
  _id: ObjectId;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: Date;
  projectId: ObjectId;
  assignedTo?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientUser {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

interface ProjectWithClient {
  _id: ObjectId;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  client: ClientUser;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  completedTasks: number;
  upcomingDeadlines: number;
}

interface ManagerDashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectsOnHold: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  averageProgress: number;
  totalBudget: number;
  thisMonthCompleted: number;
  clientCount: number;
  recentProjects: ProjectWithClient[];
  urgentTasks: Array<{
    _id: string;
    title: string;
    deadline: string;
    projectTitle: string;
    priority: string;
  }>;
  projectsByStatus: {
    planning: number;
    in_progress: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  };
}

// Server-side data fetching with comprehensive error handling
async function getManagerDashboardData(managerId: string): Promise<ManagerDashboardStats> {
  try {
    const { db } = await connectToDatabase();
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextWeek = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Build queries for manager's data only
    const projectFilter: Filter<ProjectDocument> = {
      manager: new ObjectId(managerId)
    };

    // Execute all queries in parallel for optimal performance
    const [projectStats, taskStats, recentProjectsData, urgentTasksData] = await Promise.all([
      // Project statistics
      db.collection<ProjectDocument>('projects').aggregate([
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
            projectsOnHold: {
              $sum: {
                $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0]
              }
            },
            thisMonthCompleted: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'completed'] },
                      { $gte: ['$updatedAt', startOfMonth] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            averageProgress: { $avg: '$progress' },
            totalBudget: { $sum: '$budget' },
            planningProjects: {
              $sum: {
                $cond: [{ $eq: ['$status', 'planning'] }, 1, 0]
              }
            },
            inProgressProjects: {
              $sum: {
                $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0]
              }
            },
            cancelledProjects: {
              $sum: {
                $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
              }
            }
          }
        }
      ]).toArray(),

      // Task statistics for manager's projects
      db.collection('tasks').aggregate([
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        {
          $match: {
            'project.manager': new ObjectId(managerId)
          }
        },
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
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'completed'] },
                      { $lt: ['$deadline', currentDate] },
                      { $ne: ['$deadline', null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            upcomingDeadlines: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'completed'] },
                      { $gte: ['$deadline', currentDate] },
                      { $lte: ['$deadline', nextWeek] },
                      { $ne: ['$deadline', null] }
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

      // Recent projects with client info and task counts
      db.collection<ProjectDocument>('projects').aggregate([
        { $match: projectFilter },
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
            from: 'tasks',
            localField: '_id',
            foreignField: 'projectId',
            as: 'tasks'
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            taskCount: { $size: '$tasks' },
            completedTasks: {
              $size: {
                $filter: {
                  input: '$tasks',
                  cond: { $eq: ['$$this.status', 'completed'] }
                }
              }
            },
            upcomingDeadlines: {
              $size: {
                $filter: {
                  input: '$tasks',
                  cond: {
                    $and: [
                      { $ne: ['$$this.status', 'completed'] },
                      { $gte: ['$$this.deadline', currentDate] },
                      { $lte: ['$$this.deadline', nextWeek] },
                      { $ne: ['$$this.deadline', null] }
                    ]
                  }
                }
              }
            }
          }
        },
        { $unset: ['clientData', 'tasks'] },
        { $sort: { updatedAt: -1 } },
        { $limit: 6 }
      ]).toArray(),

      // Urgent tasks due soon
      db.collection('tasks').aggregate([
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        {
          $match: {
            'project.manager': new ObjectId(managerId),
            status: { $ne: 'completed' },
            deadline: {
              $gte: currentDate,
              $lte: nextWeek
            }
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$project', 0] }
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            deadline: 1,
            priority: 1,
            projectTitle: '$project.title'
          }
        },
        { $sort: { deadline: 1 } },
        { $limit: 5 }
      ]).toArray()
    ]);

    // Process the aggregated data with proper error handling
    const projectStatsData = projectStats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      projectsOnHold: 0,
      thisMonthCompleted: 0,
      averageProgress: 0,
      totalBudget: 0,
      planningProjects: 0,
      inProgressProjects: 0,
      cancelledProjects: 0
    };

    const taskStatsData = taskStats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      upcomingDeadlines: 0
    };

    // Transform recent projects with proper typing - FIXED
    const transformedRecentProjects: ProjectWithClient[] = recentProjectsData.map(project => ({
      _id: project._id,
      title: project.title,
      description: project.description,
      status: project.status,
      priority: project.priority,
      progress: project.progress,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      client: project.client || { _id: new ObjectId(), name: 'Unknown Client', email: '' },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      taskCount: project.taskCount,
      completedTasks: project.completedTasks,
      upcomingDeadlines: project.upcomingDeadlines
    } as ProjectWithClient));

    // Transform urgent tasks - FIXED
    const transformedUrgentTasks = urgentTasksData.map(task => ({
      _id: task._id.toString(),
      title: task.title,
      deadline: task.deadline.toISOString(),
      projectTitle: task.projectTitle || 'Unknown Project',
      priority: task.priority
    }));

    // Count unique clients
    const uniqueClients = new Set(transformedRecentProjects.map(p => p.client._id.toString()));

    return {
      // Project metrics
      totalProjects: projectStatsData.totalProjects,
      activeProjects: projectStatsData.activeProjects,
      completedProjects: projectStatsData.completedProjects,
      projectsOnHold: projectStatsData.projectsOnHold,
      
      // Task metrics
      totalTasks: taskStatsData.totalTasks,
      completedTasks: taskStatsData.completedTasks,
      pendingTasks: taskStatsData.pendingTasks,
      overdueTasks: taskStatsData.overdueTasks,
      upcomingDeadlines: taskStatsData.upcomingDeadlines,
      
      // Performance metrics
      averageProgress: Math.round((projectStatsData.averageProgress || 0) * 100) / 100,
      totalBudget: projectStatsData.totalBudget || 0,
      thisMonthCompleted: projectStatsData.thisMonthCompleted,
      clientCount: uniqueClients.size,
      
      // Detailed data
      recentProjects: transformedRecentProjects,
      urgentTasks: transformedUrgentTasks,
      
      // Status breakdown
      projectsByStatus: {
        planning: projectStatsData.planningProjects,
        in_progress: projectStatsData.inProgressProjects,
        completed: projectStatsData.completedProjects,
        on_hold: projectStatsData.projectsOnHold,
        cancelled: projectStatsData.cancelledProjects
      }
    };

  } catch (error) {
    console.error('Error fetching manager dashboard data:', error);
    
    // Return safe default structure on error
    return {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      projectsOnHold: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      upcomingDeadlines: 0,
      averageProgress: 0,
      totalBudget: 0,
      thisMonthCompleted: 0,
      clientCount: 0,
      recentProjects: [],
      urgentTasks: [],
      projectsByStatus: {
        planning: 0,
        in_progress: 0,
        completed: 0,
        on_hold: 0,
        cancelled: 0
      }
    };
  }
}

// Utility functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  return formatDate(date);
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'planning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'on_hold':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Loading component for better UX
function ManagerDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Main Manager Dashboard Component
async function ManagerDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'project_manager') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const stats = await getManagerDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Mobile-First Design */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {session.user.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-600 mt-1">
            Here&apos;s an overview of your projects and tasks
          </p>
        </div>
        <Link href="/manager/projects/new">
          <Button className="w-full sm:w-auto min-h-[44px] touch-manipulation">
            <PlusCircle className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Key Metrics Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Projects */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {stats.activeProjects} active
                </p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="w-full">
                <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.averageProgress}%</p>
                <div className="mt-2">
                  <Progress value={stats.averageProgress} className="h-2" />
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 ml-4" />
            </div>
          </CardContent>
        </Card>

        {/* Tasks Overview */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-green-600">{stats.completedTasks} done</span>
                  {stats.overdueTasks > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.overdueTasks} overdue
                    </Badge>
                  )}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Due This Week</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.upcomingDeadlines}</p>
                <p className="text-xs text-orange-600 mt-1">
                  {stats.clientCount} clients
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid - Mobile-First Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects - Takes 2 columns on large screens */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
            <Link href="/manager/projects">
              <Button variant="ghost" size="sm" className="text-sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentProjects.length > 0 ? (
              stats.recentProjects.map((project) => (
                <Link 
                  key={project._id.toString()} 
                  href={`/manager/projects/${project._id.toString()}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {project.title}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getStatusColor(project.status))}
                        >
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 truncate">
                        Client: {project.client.name}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{project.taskCount} tasks</span>
                        <span>{project.completedTasks} completed</span>
                        {project.upcomingDeadlines > 0 && (
                          <span className="text-orange-600">
                            {project.upcomingDeadlines} due soon
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-gray-900">
                        {project.progress}%
                      </div>
                      <Progress value={project.progress} className="h-2 w-16 mt-1" />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No projects yet</p>
                <Link href="/manager/projects/new">
                  <Button variant="outline" size="sm" className="mt-2">
                    Create Your First Project
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent Tasks Sidebar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Urgent Tasks</CardTitle>
            <Link href="/manager/tasks">
              <Button variant="ghost" size="sm" className="text-sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.urgentTasks.length > 0 ? (
              stats.urgentTasks.map((task) => (
                <div key={task._id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {task.projectTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getPriorityColor(task.priority))}
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Due {formatDate(new Date(task.deadline))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No urgent tasks</p>
                <p className="text-xs text-gray-400">You&apos;re all caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Status Overview & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Project Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.projectsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getStatusColor(status))}
                    >
                      {status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium">{count} projects</span>
                  </div>
                  <div className="flex-1 mx-4">
                    <Progress 
                      value={stats.totalProjects > 0 ? (count / stats.totalProjects) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                  <span className="text-xs text-gray-500 min-w-[3rem] text-right">
                    {stats.totalProjects > 0 ? Math.round((count / stats.totalProjects) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Actions & Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.thisMonthCompleted}</div>
                <div className="text-xs text-green-700">Completed This Month</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalBudget > 0 ? formatCurrency(stats.totalBudget) : 'N/A'}
                </div>
                <div className="text-xs text-blue-700">Total Budget</div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-3">
              <Link href="/manager/projects/new" className="block">
                <Button className="w-full justify-start min-h-[44px]" variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create New Project
                </Button>
              </Link>
              
              <Link href="/manager/tasks" className="block">
                <Button className="w-full justify-start min-h-[44px]" variant="outline">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Manage Tasks
                </Button>
              </Link>
              
              <Link href="/manager/messages" className="block">
                <Button className="w-full justify-start min-h-[44px]" variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Client Messages
                </Button>
              </Link>
              
              <Link href="/manager/files" className="block">
                <Button className="w-full justify-start min-h-[44px]" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Project Files
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      {stats.totalProjects > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((stats.completedProjects / stats.totalProjects) * 100)}%
                </div>
                <div className="text-sm text-gray-500">Project Success Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-500">Task Completion Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.clientCount}</div>
                <div className="text-sm text-gray-500">Active Clients</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.totalProjects > 0 ? Math.round(stats.averageProgress) : 0}%
                </div>
                <div className="text-sm text-gray-500">Avg Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welcome Message for New Managers */}
      {stats.totalProjects === 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to Your Project Dashboard!
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Get started by creating your first project. You&apos;ll be able to track progress, 
                manage tasks, and communicate with clients all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/manager/projects/new">
                  <Button className="min-h-[44px]">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Your First Project
                  </Button>
                </Link>
                <Link href="/manager/help">
                  <Button variant="outline" className="min-h-[44px]">
                    <Activity className="h-4 w-4 mr-2" />
                    View Help Guide
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main exported component with proper error boundaries
export default async function ManagerDashboardPage() {
  return (
    <Suspense fallback={<ManagerDashboardLoading />}>
      <ManagerDashboard />
    </Suspense>
  );
}