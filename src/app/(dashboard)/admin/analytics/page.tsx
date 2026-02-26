// src/app/(dashboard)/admin/analytics/page.tsx
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';

// Define types for MongoDB documents
interface Project {
  _id: ObjectId;
  client?: ObjectId;
  manager?: ObjectId;
  progress: number;
  status: string;
  endDate: Date;
  startDate: Date;
  budget: number;
  createdAt: Date;
}

interface Task {
  _id: ObjectId;
  projectId: ObjectId;
  status: string;
  deadline: Date;
  progress: number;
  estimatedHours: number;
  actualHours: number;
}

interface Message {
  _id: ObjectId;
  projectId: ObjectId;
  createdAt: Date;
}

interface FileDocument {
  _id: ObjectId;
  projectId: ObjectId;
  category: string;
  size: number;
}

// Define aggregation result types
interface ProjectAnalyticsResult {
  _id: null;
  totalProjects: number;
  averageProgress: number;
  completedProjects: number;
  overdueProjects: number;
  totalBudget: number;
  averageDuration: number;
}

interface TaskAnalyticsResult {
  _id: null;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageProgress: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

interface UserActivityResult {
  _id: {
    date: string;
  };
  messageCount: number;
}

interface FileAnalyticsResult {
  _id: string;
  count: number;
  totalSize: number;
}

interface StatusDistributionResult {
  _id: string;
  count: number;
}

interface MonthlyTrendResult {
  _id: {
    year: number;
    month: number;
  };
  count: number;
}

interface AnalyticsData {
  projects: ProjectAnalyticsResult;
  tasks: TaskAnalyticsResult;
  userActivity: UserActivityResult[];
  files: FileAnalyticsResult[];
  statusDistribution: StatusDistributionResult[];
  monthlyTrend: MonthlyTrendResult[];
}

async function getAnalyticsData(userId: string, userRole: string): Promise<AnalyticsData> {
  const { db } = await connectToDatabase();

  // Build query based on user role with proper typing
  const projectsQuery: Filter<Project> = {};
  
  if (userRole === 'client') {
    projectsQuery.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectsQuery.manager = new ObjectId(userId);
  }

  // Get projects for this user
  const userProjects = await db.collection<Project>('projects')
    .find(projectsQuery)
    .project({ _id: 1 })
    .toArray();

  const projectIds = userProjects.map(p => p._id);

  // Project Analytics
  const projectAnalytics = await db.collection<Project>('projects').aggregate<ProjectAnalyticsResult>([
    { $match: userRole === 'super_admin' ? {} : { _id: { $in: projectIds } } },
    {
      $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        averageProgress: { $avg: '$progress' },
        completedProjects: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        overdueProjects: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$endDate', new Date()] },
                  { $ne: ['$status', 'completed'] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalBudget: { $sum: '$budget' },
        averageDuration: {
          $avg: {
            $divide: [
              { $subtract: ['$endDate', '$startDate'] },
              86400000 // Convert to days
            ]
          }
        }
      }
    }
  ]).toArray();

  // Task Analytics
  const taskAnalytics = await db.collection<Task>('tasks').aggregate<TaskAnalyticsResult>([
    { $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } } },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        overdueTasks: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$deadline', new Date()] },
                  { $ne: ['$status', 'completed'] }
                ]
              },
              1,
              0
            ]
          }
        },
        averageProgress: { $avg: '$progress' },
        totalEstimatedHours: { $sum: '$estimatedHours' },
        totalActualHours: { $sum: '$actualHours' }
      }
    }
  ]).toArray();

  // User Activity
  const userActivity = await db.collection<Message>('messages').aggregate<UserActivityResult>([
    { $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        messageCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } },
    { $limit: 30 }
  ]).toArray();

  // File Analytics
  const fileAnalytics = await db.collection<FileDocument>('files').aggregate<FileAnalyticsResult>([
    { $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]).toArray();

  // Status distribution
  const statusDistribution = await db.collection<Project>('projects').aggregate<StatusDistributionResult>([
    { $match: userRole === 'super_admin' ? {} : { _id: { $in: projectIds } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  // Monthly project creation trend
  const monthlyTrend = await db.collection<Project>('projects').aggregate<MonthlyTrendResult>([
    { $match: userRole === 'super_admin' ? {} : { _id: { $in: projectIds } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 12 }
  ]).toArray();

  return {
    projects: projectAnalytics[0] || {
      _id: null,
      totalProjects: 0,
      averageProgress: 0,
      completedProjects: 0,
      overdueProjects: 0,
      totalBudget: 0,
      averageDuration: 0
    },
    tasks: taskAnalytics[0] || {
      _id: null,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      averageProgress: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0
    },
    userActivity,
    files: fileAnalytics,
    statusDistribution,
    monthlyTrend
  };
}

export default async function AnalyticsPage() {
  const session = await auth();
  
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const analytics = await getAnalyticsData(session.user.id, session.user.role);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount || 0);
  };

  const completionRate = analytics.tasks.totalTasks > 0 
    ? Math.round((analytics.tasks.completedTasks / analytics.tasks.totalTasks) * 100)
    : 0;

  const projectCompletionRate = analytics.projects.totalProjects > 0
    ? Math.round((analytics.projects.completedProjects / analytics.projects.totalProjects) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track performance and insights across your projects.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.projects.completedProjects} of {analytics.projects.totalProjects} projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.tasks.completedTasks} of {analytics.tasks.totalTasks} tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.projects.totalBudget)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(analytics.projects.overdueProjects || 0) + (analytics.tasks.overdueTasks || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Projects & tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Project Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.statusDistribution.map((status) => (
                <div key={status._id} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{status._id}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ 
                          width: `${(status.count / analytics.projects.totalProjects) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{status.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* File Categories */}
        <Card>
          <CardHeader>
            <CardTitle>File Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.files.map((file) => (
                <div key={file._id} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{file._id}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{file.count} files</span>
                    <span className="text-xs text-gray-400">
                      ({Math.round(file.totalSize / 1024 / 1024)}MB)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Time Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Estimated Hours</span>
                <span className="font-medium">{analytics.tasks.totalEstimatedHours || 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Actual Hours</span>
                <span className="font-medium">{analytics.tasks.totalActualHours || 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Efficiency</span>
                <span className="font-medium">
                  {analytics.tasks.totalEstimatedHours > 0 
                    ? Math.round((analytics.tasks.totalEstimatedHours / analytics.tasks.totalActualHours) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Projects</span>
                <span className="font-medium">
                  {Math.round(analytics.projects.averageProgress || 0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tasks</span>
                <span className="font-medium">
                  {Math.round(analytics.tasks.averageProgress || 0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Duration</span>
                <span className="font-medium">
                  {Math.round(analytics.projects.averageDuration || 0)} days
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.userActivity.slice(-5).map((activity, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-sm text-gray-600">{activity._id.date}</span>
                  <span className="font-medium">{activity.messageCount} messages</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}