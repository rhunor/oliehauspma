// src/app/(dashboard)/client/page.tsx - ENHANCED CLIENT DASHBOARD
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import { 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  Calendar,
  MessageSquare,
  ArrowRight,
  Eye,
  TrendingUp,
  ClipboardList,
  FileText,
  Activity,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Enhanced TypeScript interfaces for better type safety
interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate: string;
  endDate: string;
  manager: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TodaysReport {
  date: string;
  projectId: string;
  projectTitle: string;
  activities: DailyActivity[];
  summary: {
    completed: number;
    inProgress: number;
    pending: number;
    totalHours?: number;
    crewSize?: number;
  };
  lastUpdated: string;
  hasUpdates: boolean;
}

interface DailyActivity {
  _id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  description?: string;
  startTime?: string;
  endTime?: string;
  contractor?: string;
  supervisor?: string;
  completedAt?: string;
}

interface CompletedTask {
  _id: string;
  title: string;
  description?: string;
  completedDate: string;
  projectId: string;
  projectTitle: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  completedBy?: string;
}

interface PendingTask {
  _id: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  estimatedDuration?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  projectTitle: string;
  dependencies?: string[];
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  unreadMessages: number;
  todaysReports: TodaysReport[];
  completedTasks: CompletedTask[];
  pendingTasks: PendingTask[];
  overallProgress: number;
}

interface RecentUpdate {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  type: 'info' | 'success' | 'warning' | 'error';
  projectId?: string;
}

interface RecentFile {
  _id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: number;
  projectId?: string;
}

// Utility functions for consistent styling
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'planning': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'delayed': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
};

// Server-side data fetching function
async function getClientDashboardData(clientId: string): Promise<{
  stats: DashboardStats;
  activeProject: Project | null;
  recentUpdates: RecentUpdate[];
  recentFiles: RecentFile[];
}> {
  try {
    const { db } = await connectToDatabase();
    const currentDate = new Date();
    const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
    const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));

    // Fetch client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .toArray();

    // Get today's reports for all client projects
    const projectIds = projects.map(p => p._id);
    const todaysReports = await db.collection('dailyProgress')
      .find({
        project: { $in: projectIds },
        date: { $gte: todayStart, $lte: todayEnd }
      })
      .toArray();

    // Get completed tasks (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const completedTasks = await db.collection('tasks')
      .find({
        projectId: { $in: projectIds },
        status: 'completed',
        completedAt: { $gte: thirtyDaysAgo }
      })
      .limit(50)
      .sort({ completedAt: -1 })
      .toArray();

    // Get pending tasks
    const pendingTasks = await db.collection('tasks')
      .find({
        projectId: { $in: projectIds },
        status: { $in: ['pending', 'in_progress'] }
      })
      .limit(20)
      .sort({ priority: 1, scheduledDate: 1 })
      .toArray();

    // Get recent updates
    const recentUpdates = await db.collection('updates')
      .find({ 
        projectId: { $in: projectIds },
        createdAt: { $gte: thirtyDaysAgo }
      })
      .limit(10)
      .sort({ createdAt: -1 })
      .toArray();

    // Get recent files
    const recentFiles = await db.collection('files')
      .find({ 
        projectId: { $in: projectIds },
        uploadedAt: { $gte: thirtyDaysAgo }
      })
      .limit(5)
      .sort({ uploadedAt: -1 })
      .toArray();

    // Find the most active project
    const activeProject = projects.find(p => p.status === 'in_progress') || projects[0] || null;

    // Calculate stats
    const stats: DashboardStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => ['in_progress', 'planning'].includes(p.status)).length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      unreadMessages: 0, // This would be fetched from messages API
      todaysReports: todaysReports.map(report => ({
        date: report.date.toISOString(),
        projectId: report.project.toString(),
        projectTitle: projects.find(p => p._id.equals(report.project))?.title || 'Unknown Project',
        activities: report.activities || [],
        summary: report.summary || { completed: 0, inProgress: 0, pending: 0 },
        lastUpdated: report.updatedAt?.toISOString() || report.createdAt.toISOString(),
        hasUpdates: report.activities?.length > 0 || false
      })),
      completedTasks: completedTasks.map(task => ({
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        completedDate: task.completedAt?.toISOString() || task.updatedAt.toISOString(),
        projectId: task.projectId.toString(),
        projectTitle: projects.find(p => p._id.equals(task.projectId))?.title || 'Unknown Project',
        category: task.category || 'other',
        completedBy: task.completedBy
      })),
      pendingTasks: pendingTasks.map(task => ({
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        scheduledDate: task.scheduledDate?.toISOString(),
        estimatedDuration: task.estimatedDuration,
        priority: task.priority || 'medium',
        projectId: task.projectId.toString(),
        projectTitle: projects.find(p => p._id.equals(task.projectId))?.title || 'Unknown Project',
        dependencies: task.dependencies || []
      })),
      overallProgress: projects.length > 0 
        ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
        : 0
    };

    return {
      stats,
      activeProject: activeProject ? {
        _id: activeProject._id.toString(),
        title: activeProject.title,
        description: activeProject.description,
        status: activeProject.status,
        priority: activeProject.priority,
        progress: activeProject.progress || 0,
        startDate: activeProject.startDate?.toISOString() || '',
        endDate: activeProject.endDate?.toISOString() || '',
        manager: {
          _id: activeProject.manager._id?.toString() || '',
          name: activeProject.manager.name || '',
          email: activeProject.manager.email || ''
        },
        createdAt: activeProject.createdAt.toISOString(),
        updatedAt: activeProject.updatedAt.toISOString()
      } : null,
      recentUpdates: recentUpdates.map(update => ({
        _id: update._id.toString(),
        title: update.title,
        message: update.message,
        createdAt: update.createdAt.toISOString(),
        type: update.type || 'info',
        projectId: update.projectId?.toString()
      })),
      recentFiles: recentFiles.map(file => ({
        _id: file._id.toString(),
        name: file.name,
        type: file.type,
        uploadedAt: file.uploadedAt.toISOString(),
        size: file.size,
        projectId: file.projectId?.toString()
      }))
    };

  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    throw new Error('Failed to fetch dashboard data');
  }
}

// Enhanced Today's Report Card Component
function TodaysReportCard({ reports }: { reports: TodaysReport[] }) {
  const hasReports = reports.length > 0;
  const totalActivities = reports.reduce((sum, r) => r.activities.length, 0);
  const completedToday = reports.reduce((sum, r) => r.summary.completed, 0);

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Today&apos;s Report
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!hasReports ? (
          <div className="text-center py-6">
            <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No updates for today</p>
            <p className="text-gray-400 text-xs mt-1">Check back later for daily progress</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-700">{completedToday}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">{totalActivities}</p>
                <p className="text-xs text-blue-600">Total Activities</p>
              </div>
            </div>

            {/* Recent Activities Preview */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Latest Updates</h4>
              {reports.slice(0, 2).map((report) => (
                <div key={report.projectId} className="border-l-2 border-blue-500 pl-3 py-2">
                  <p className="font-medium text-gray-900 text-sm">{report.projectTitle}</p>
                  <p className="text-gray-600 text-xs">
                    {report.summary.completed} completed, {report.summary.inProgress} in progress
                  </p>
                  <p className="text-gray-400 text-xs">
                    Updated {formatTimeAgo(new Date(report.lastUpdated))}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <Link href="/client/daily-reports">
              <Button variant="outline" size="sm" className="w-full mt-4">
                <Eye className="h-4 w-4 mr-2" />
                View Full Report
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Enhanced Completed Tasks Card Component
function CompletedTasksCard({ tasks }: { tasks: CompletedTask[] }) {
  const recentTasks = tasks.slice(0, 5);
  const totalCompleted = tasks.length;
  const thisWeekCompleted = tasks.filter(task => {
    const taskDate = new Date(task.completedDate);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return taskDate >= weekAgo;
  }).length;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completed Tasks
          </CardTitle>
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            {totalCompleted} Total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {totalCompleted === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No completed tasks yet</p>
            <p className="text-gray-400 text-xs mt-1">Completed work will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xl font-bold text-green-700">{thisWeekCompleted}</p>
                <p className="text-xs text-green-600">This Week</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xl font-bold text-blue-700">{totalCompleted}</p>
                <p className="text-xs text-blue-600">All Time</p>
              </div>
            </div>

            {/* Recent Completions */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Recent Completions</h4>
              {recentTasks.map((task) => (
                <div key={task._id} className="border-l-2 border-green-500 pl-3 py-2">
                  <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-600 text-xs">{task.projectTitle}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.category}
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {formatTimeAgo(new Date(task.completedDate))}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <Link href="/client/completed-tasks">
              <Button variant="outline" size="sm" className="w-full mt-4">
                <TrendingUp className="h-4 w-4 mr-2" />
                View All Completed
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Enhanced Pending Tasks Card Component
function PendingTasksCard({ tasks }: { tasks: PendingTask[] }) {
  const urgentTasks = tasks.filter(task => task.priority === 'urgent').length;
  const upcomingTasks = tasks.filter(task => {
    if (!task.scheduledDate) return false;
    const taskDate = new Date(task.scheduledDate);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return taskDate <= nextWeek;
  }).length;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Pending Tasks
          </CardTitle>
          {urgentTasks > 0 && (
            <Badge variant="destructive" className="text-xs">
              {urgentTasks} Urgent
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No pending tasks</p>
            <p className="text-gray-400 text-xs mt-1">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xl font-bold text-orange-700">{upcomingTasks}</p>
                <p className="text-xs text-orange-600">Due Soon</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xl font-bold text-blue-700">{tasks.length}</p>
                <p className="text-xs text-blue-600">Total Pending</p>
              </div>
            </div>

            {/* High Priority Tasks */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">High Priority</h4>
              {tasks
                .filter(task => ['urgent', 'high'].includes(task.priority))
                .slice(0, 3)
                .map((task) => (
                  <div key={task._id} className="border-l-2 border-orange-500 pl-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-xs">{task.projectTitle}</p>
                    {task.scheduledDate && (
                      <p className="text-gray-400 text-xs">
                        Due {formatTimeAgo(new Date(task.scheduledDate))}
                      </p>
                    )}
                  </div>
                ))}
            </div>

            {/* Action Button */}
            <Link href="/client/pending-tasks">
              <Button variant="outline" size="sm" className="w-full mt-4">
                <AlertCircle className="h-4 w-4 mr-2" />
                View All Pending
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const { stats, activeProject, recentUpdates, recentFiles } = await getClientDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {session.user.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-600 mt-1">
            Here&apos;s your project overview and today&apos;s updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/client/projects">
            <Button variant="outline" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              All Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Enhanced Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Report Card */}
        <TodaysReportCard reports={stats.todaysReports} />

        {/* Completed Tasks Card */}
        <CompletedTasksCard tasks={stats.completedTasks} />

        {/* Pending Tasks Card */}
        <PendingTasksCard tasks={stats.pendingTasks} />
      </div>

      {/* Quick Stats Row */}
      {stats.totalProjects > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Projects</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-medium">{stats.activeProjects} active</span>
                <span className="text-gray-500 ml-2">• {stats.completedProjects} completed</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overallProgress}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-4">
                <Progress value={stats.overallProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unreadMessages}</p>
                </div>
                <MessageSquare className={`h-8 w-8 ${
                  stats.unreadMessages > 0 ? 'text-purple-600' : 'text-gray-400'
                }`} />
              </div>
              <div className="mt-4 flex items-center text-sm">
                {stats.unreadMessages > 0 ? (
                  <span className="text-purple-600 font-medium">Awaiting your response</span>
                ) : (
                  <span className="text-green-600 font-medium">All caught up</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Files</p>
                  <p className="text-2xl font-bold text-gray-900">{recentFiles.length}</p>
                </div>
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-600 font-medium">Recent uploads</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Project Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">Current Project</CardTitle>
              <Link href="/client/projects">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!activeProject ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Projects</h3>
                  <p className="text-gray-600">You don&apos;t have any active projects at the moment.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Project Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{activeProject.title}</h3>
                        <Badge className={getStatusColor(activeProject.status)}>
                          {activeProject.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(activeProject.priority)}>
                          {activeProject.priority}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-4">{activeProject.description}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-semibold text-gray-900">{activeProject.progress}%</span>
                    </div>
                    <Progress value={activeProject.progress} className="h-3" />
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Project Manager</label>
                        <p className="text-gray-900">{activeProject.manager.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Start Date</label>
                        <p className="text-gray-900">
                          {new Date(activeProject.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className="text-gray-900 capitalize">
                          {activeProject.status.replace('_', ' ')}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Expected Completion</label>
                        <p className="text-gray-900">
                          {new Date(activeProject.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Quick Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Link href={`/client/projects/${activeProject._id}`}>
                      <Button size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/client/projects/${activeProject._id}/schedule`}>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        View Work Schedule
                      </Button>
                    </Link>
                    <Link href={`/client/messages?project=${activeProject._id}`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Contact Team
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Updates</CardTitle>
            </CardHeader>
            <CardContent>
              {recentUpdates.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No recent updates</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentUpdates.slice(0, 3).map((update) => (
                    <div key={update._id} className="border-l-2 border-blue-500 pl-3">
                      <h4 className="font-medium text-gray-900 text-sm">{update.title}</h4>
                      <p className="text-gray-600 text-xs mt-1">{update.message}</p>
                      <p className="text-gray-400 text-xs mt-2">
                        {formatTimeAgo(new Date(update.createdAt))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Files</CardTitle>
              <Link href="/client/files">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No recent files</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFiles.map((file) => (
                    <div key={file._id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTimeAgo(new Date(file.uploadedAt))}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {file.type.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Assistant - Moved to bottom as requested */}
          <Card className="border-2 border-dashed border-purple-200 bg-purple-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Need Help?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Get instant answers about your projects
                  </p>
                </div>
                <Link href="/client/ai-assistant">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    AI Assistant
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}