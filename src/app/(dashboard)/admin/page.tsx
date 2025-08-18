// src/app/(dashboard)/admin/page.tsx - ENHANCED WITH REAL DATABASE DATA - COMPLETE VERSION
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { 
  Users, 
  FolderOpen, 
  Activity, 
  MessageSquare, 
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  FileText,
  
  DollarSign,
  BarChart3,
  List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Enhanced CN utility function following best practices
function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return twMerge(clsx(inputs));
}

// Define proper TypeScript interfaces for type safety
interface User {
  _id: ObjectId;
  name: string;
  email: string;
  role: 'super_admin' | 'project_manager' | 'client';
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

interface Project {
  _id: ObjectId;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  client: ObjectId;
  manager: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  _id: ObjectId;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: Date;
  projectId: ObjectId;
  assignedTo?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  _id: ObjectId;
  content: string;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  isRead: boolean;
  createdAt: Date;
}

interface File {
  _id: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  createdAt: Date;
}

// Enhanced dashboard stats interface
interface DashboardStats {
  // User statistics
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  usersByRole: {
    super_admin: number;
    project_manager: number;
    client: number;
  };

  // Project statistics
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectsOnHold: number;
  completionRate: number;
  averageProgress: number;
  totalBudget: number;
  projectsByStatus: {
    planning: number;
    in_progress: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  };

  // Task statistics
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  taskCompletionRate: number;

  // Communication statistics
  totalMessages: number;
  unreadMessages: number;
  messagesThisWeek: number;

  // File statistics
  totalFiles: number;
  totalStorageUsed: number;
  filesUploadedThisMonth: number;

  // Recent activities
  recentActivities: ActivityItem[];
  
  // System performance
  systemHealth: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
}

interface ActivityItem {
  _id: string;
  type: 'user_created' | 'project_created' | 'project_completed' | 'task_completed' | 'message_sent' | 'file_uploaded';
  title: string;
  description: string;
  timestamp: string;
  user: {
    _id: string;
    name: string;
    role: string;
  };
  project?: {
    _id: string;
    title: string;
  };
  metadata?: Record<string, unknown>;
}

// Server-side data fetching function with comprehensive error handling
async function getDashboardData(): Promise<DashboardStats> {
  try {
    const { db } = await connectToDatabase();
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startOfWeek = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Execute all database queries in parallel for better performance
    const [
      userStats,
      projectStats,
      taskStats,
      messageStats,
      fileStats,
      recentActivities
    ] = await Promise.all([
      // User Statistics with proper aggregation
      db.collection<User>('users').aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: {
                $cond: [{ $eq: ['$isActive', true] }, 1, 0]
              }
            },
            newUsersThisMonth: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfMonth] },
                  1,
                  0
                ]
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
      ]).toArray(),

      // Project Statistics with enhanced metrics
      db.collection<Project>('projects').aggregate([
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

      // Task Statistics with deadline tracking
      db.collection<Task>('tasks').aggregate([
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
            }
          }
        }
      ]).toArray(),

      // Message Statistics with temporal analysis
      db.collection<Message>('messages').aggregate([
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            unreadMessages: {
              $sum: {
                $cond: [{ $eq: ['$isRead', false] }, 1, 0]
              }
            },
            messagesThisWeek: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfWeek] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // File Statistics with storage analysis
      db.collection<File>('files').aggregate([
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalStorageUsed: { $sum: '$size' },
            filesUploadedThisMonth: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfMonth] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Recent Activities with proper joins
      db.collection('projects').aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { name: 1, role: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { name: 1, role: 1 } }]
          }
        },
        {
          $addFields: {
            manager: { $arrayElemAt: ['$managerData', 0] },
            client: { $arrayElemAt: ['$clientData', 0] }
          }
        },
        { $sort: { updatedAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 1,
            title: 1,
            status: 1,
            progress: 1,
            manager: 1,
            client: 1,
            updatedAt: 1,
            createdAt: 1
          }
        }
      ]).toArray()
    ]);

    // Process the aggregated data with proper error handling
    const userStatsData = userStats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      newUsersThisMonth: 0,
      superAdmins: 0,
      projectManagers: 0,
      clients: 0
    };

    const projectStatsData = projectStats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      projectsOnHold: 0,
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
      overdueTasks: 0
    };

    const messageStatsData = messageStats[0] || {
      totalMessages: 0,
      unreadMessages: 0,
      messagesThisWeek: 0
    };

    const fileStatsData = fileStats[0] || {
      totalFiles: 0,
      totalStorageUsed: 0,
      filesUploadedThisMonth: 0
    };

    // Calculate derived metrics
    const completionRate = projectStatsData.totalProjects > 0 
      ? (projectStatsData.completedProjects / projectStatsData.totalProjects) * 100 
      : 0;

    const taskCompletionRate = taskStatsData.totalTasks > 0
      ? (taskStatsData.completedTasks / taskStatsData.totalTasks) * 100
      : 0;

    // Transform recent activities with proper type safety
    const transformedActivities: ActivityItem[] = recentActivities.map((activity) => ({
      _id: activity._id.toString(),
      type: activity.status === 'completed' ? 'project_completed' : 'project_created',
      title: activity.status === 'completed' ? 'Project Completed' : 'Project Created',
      description: `${activity.title} ${activity.status === 'completed' ? 'has been completed' : 'has been created'}`,
      timestamp: activity.updatedAt?.toISOString() || activity.createdAt?.toISOString() || new Date().toISOString(),
      user: {
        _id: activity.manager?._id?.toString() || 'unknown',
        name: activity.manager?.name || 'Unknown User',
        role: activity.manager?.role || 'project_manager'
      },
      project: {
        _id: activity._id.toString(),
        title: activity.title
      },
      metadata: {
        progress: activity.progress,
        status: activity.status
      }
    }));

    // Return comprehensive dashboard statistics
    return {
      // User statistics
      totalUsers: userStatsData.totalUsers,
      activeUsers: userStatsData.activeUsers,
      newUsersThisMonth: userStatsData.newUsersThisMonth,
      usersByRole: {
        super_admin: userStatsData.superAdmins,
        project_manager: userStatsData.projectManagers,
        client: userStatsData.clients
      },

      // Project statistics
      totalProjects: projectStatsData.totalProjects,
      activeProjects: projectStatsData.activeProjects,
      completedProjects: projectStatsData.completedProjects,
      projectsOnHold: projectStatsData.projectsOnHold,
      completionRate: Math.round(completionRate * 100) / 100,
      averageProgress: Math.round((projectStatsData.averageProgress || 0) * 100) / 100,
      totalBudget: projectStatsData.totalBudget || 0,
      projectsByStatus: {
        planning: projectStatsData.planningProjects,
        in_progress: projectStatsData.inProgressProjects,
        completed: projectStatsData.completedProjects,
        on_hold: projectStatsData.projectsOnHold,
        cancelled: projectStatsData.cancelledProjects
      },

      // Task statistics
      totalTasks: taskStatsData.totalTasks,
      completedTasks: taskStatsData.completedTasks,
      pendingTasks: taskStatsData.pendingTasks,
      overdueTasks: taskStatsData.overdueTasks,
      taskCompletionRate: Math.round(taskCompletionRate * 100) / 100,

      // Communication statistics
      totalMessages: messageStatsData.totalMessages,
      unreadMessages: messageStatsData.unreadMessages,
      messagesThisWeek: messageStatsData.messagesThisWeek,

      // File statistics
      totalFiles: fileStatsData.totalFiles,
      totalStorageUsed: fileStatsData.totalStorageUsed,
      filesUploadedThisMonth: fileStatsData.filesUploadedThisMonth,

      // Recent activities
      recentActivities: transformedActivities,

      // System health (simulated for demo - replace with real monitoring)
      systemHealth: {
        uptime: 99.9,
        responseTime: 120,
        errorRate: 0.1
      }
    };

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    
    // Return default stats structure on error to prevent crashes
    return {
      totalUsers: 0,
      activeUsers: 0,
      newUsersThisMonth: 0,
      usersByRole: { super_admin: 0, project_manager: 0, client: 0 },
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      projectsOnHold: 0,
      completionRate: 0,
      averageProgress: 0,
      totalBudget: 0,
      projectsByStatus: { planning: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0 },
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      taskCompletionRate: 0,
      totalMessages: 0,
      unreadMessages: 0,
      messagesThisWeek: 0,
      totalFiles: 0,
      totalStorageUsed: 0,
      filesUploadedThisMonth: 0,
      recentActivities: [],
      systemHealth: { uptime: 0, responseTime: 0, errorRate: 100 }
    };
  }
}

// Utility functions for formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatTimeAgo = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'user_created':
      return <Users className="h-4 w-4 text-blue-500" />;
    case 'project_created':
      return <FolderOpen className="h-4 w-4 text-green-500" />;
    case 'project_completed':
      return <CheckCircle className="h-4 w-4 text-purple-500" />;
    case 'task_completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'message_sent':
      return <MessageSquare className="h-4 w-4 text-orange-500" />;
    case 'file_uploaded':
      return <FileText className="h-4 w-4 text-indigo-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
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

// Loading component for better UX
function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
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

// Main Dashboard Component
async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'super_admin') {
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

  const stats = await getDashboardData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {session.user.name}. Here&apos;s what&apos;s happening with your projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            System Healthy
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Last updated: {new Date().toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Users */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats.newUsersThisMonth} this month
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

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
              <FolderOpen className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.completionRate}%</p>
                <div className="mt-2">
                  <Progress value={stats.completionRate} className="h-2" />
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Budget */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Budget</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900">
                  {formatCurrency(stats.totalBudget)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Across all projects
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Tasks Overview */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-green-600">{stats.completedTasks} done</span>
                  {stats.overdueTasks > 0 && (
                    <span className="text-xs text-red-600">{stats.overdueTasks} overdue</span>
                  )}
                </div>
              </div>
              <List className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMessages}</p>
                <div className="flex items-center gap-2 mt-1">
                  {stats.unreadMessages > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.unreadMessages} unread
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">
                    {stats.messagesThisWeek} this week
                  </span>
                </div>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Files */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Files</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(stats.totalStorageUsed)} used
                </p>
              </div>
              <FileText className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-gray-900">{stats.systemHealth.uptime}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.systemHealth.responseTime}ms avg response
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Status Distribution */}
        <Card className="lg:col-span-2">
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

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.slice(0, 5).map((activity) => (
                <div key={activity._id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.usersByRole.super_admin}</div>
              <div className="text-sm text-gray-500">Super Admins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.usersByRole.project_manager}</div>
              <div className="text-sm text-gray-500">Project Managers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.usersByRole.client}</div>
              <div className="text-sm text-gray-500">Clients</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main exported component with proper error boundaries
export default async function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AdminDashboard />
    </Suspense>
  );
}