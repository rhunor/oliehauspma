// FILE: src/app/(dashboard)/client/page.tsx - FIXED MONGODB TYPING
// ✅ FIXED: Proper MongoDB Document typing with TypeScript

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, WithId, Document } from 'mongodb';
import Link from 'next/link';
import { 
  BarChart3, 
  FolderOpen, 
  Calendar, 
  Clock,
  FileText, 
  MessageCircle, 
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowRight,
  TrendingUp,
  Users,
  Target,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ✅ FIXED: Proper TypeScript interfaces for MongoDB documents
interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  recentMessages: number;
  totalFiles: number;
}

// ✅ FIXED: Proper interface for MongoDB project document
interface ProjectDocument extends Document {
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate?: Date;
  endDate?: Date;
  client: ObjectId;
  manager: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ FIXED: Separate interface for populated project data
interface ActiveProject {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate?: Date;
  endDate?: Date;
  manager: {
    _id: string;
    name: string;
    email: string;
  };
  client: {
    _id: string;
    name: string;
    email: string;
  };
}

interface RecentUpdate {
  _id: string;
  type: 'task_completed' | 'project_updated' | 'file_uploaded' | 'message_sent' | 'daily_report';
  title: string;
  description: string;
  timestamp: string;
  project?: {
    _id: string;
    title: string;
  };
  user?: {
    _id: string;
    name: string;
    role: string;
  };
}

interface RecentFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  category: 'document' | 'image' | 'video' | 'audio' | 'other';
  uploadedAt: Date;
  uploadedBy: {
    name: string;
  };
  project?: {
    title: string;
  };
}

// Helper functions
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'planning': return 'bg-yellow-100 text-yellow-800';
    case 'on_hold': return 'bg-orange-100 text-orange-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// ✅ FIXED: Proper MongoDB document transformation
function transformProjectToActiveProject(project: WithId<ProjectDocument>): ActiveProject {
  return {
    _id: project._id.toString(),
    title: project.title,
    description: project.description,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    startDate: project.startDate,
    endDate: project.endDate,
    manager: {
      _id: '', // Will be populated if needed
      name: 'Project Manager',
      email: 'manager@example.com'
    },
    client: {
      _id: project.client.toString(),
      name: 'Client Name',
      email: 'client@example.com'
    }
  };
}

// ✅ FIXED: Server-side data fetching with proper error handling and typing
async function getClientDashboardData(clientId: string) {
  try {
    const { db } = await connectToDatabase();
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // ✅ FIXED: Proper MongoDB query with typing
    const projects = await db.collection<ProjectDocument>('projects')
      .find({ client: new ObjectId(clientId) })
      .sort({ updatedAt: -1 })
      .toArray();

    const projectIds = projects.map(p => p._id);

    // Calculate project statistics
    const stats: ClientStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => ['planning', 'in_progress'].includes(p.status)).length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      recentMessages: 0,
      totalFiles: 0
    };

    // ✅ FIXED: Proper type conversion for active project
    let activeProject: ActiveProject | null = null;
    const activeProjectDoc = projects.find(p => p.status === 'in_progress') || projects[0];
    if (activeProjectDoc) {
      activeProject = transformProjectToActiveProject(activeProjectDoc);
    }

    // Create recent updates from projects
    const recentUpdates: RecentUpdate[] = projects.slice(0, 5).map(project => ({
      _id: project._id.toString(),
      type: 'project_updated' as const,
      title: `Project ${project.status === 'completed' ? 'Completed' : 'Updated'}`,
      description: project.title,
      timestamp: (project.updatedAt || project.createdAt).toISOString(),
      project: {
        _id: project._id.toString(),
        title: project.title
      }
    }));

    // Fetch recent files with error handling
    let recentFiles: RecentFile[] = [];
    try {
      const files = await db.collection('files')
        .find({ 
          projectId: { $in: projectIds },
          uploadedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .toArray();

      recentFiles = files.map(file => ({
        _id: file._id.toString(),
        filename: file.filename || 'Unknown',
        originalName: file.originalName || 'Unknown',
        size: file.size || 0,
        category: file.category || 'other',
        uploadedAt: file.uploadedAt || new Date(),
        uploadedBy: file.uploadedBy || { name: 'Unknown' },
        project: file.project || { title: 'Unknown Project' }
      }));

      stats.totalFiles = files.length;
    } catch (error) {
      console.log('Files collection not found or error fetching files:', error);
      recentFiles = [];
    }

    // Fetch additional statistics with error handling
    try {
      // Count tasks
      const taskCount = await db.collection('tasks')
        .countDocuments({ projectId: { $in: projectIds } });
      
      const completedTaskCount = await db.collection('tasks')
        .countDocuments({ 
          projectId: { $in: projectIds },
          status: 'completed' 
        });

      stats.completedTasks = completedTaskCount;
      stats.pendingTasks = taskCount - completedTaskCount;

      // Count recent messages
      const messageCount = await db.collection('messages')
        .countDocuments({
          projectId: { $in: projectIds },
          createdAt: { $gte: startOfMonth }
        });
      
      stats.recentMessages = messageCount;
    } catch (error) {
      console.log('Some collections not found, using default values:', error);
    }

    return {
      stats,
      activeProject,
      recentUpdates,
      recentFiles
    };

  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    
    // Return default values on error
    return {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        recentMessages: 0,
        totalFiles: 0
      },
      activeProject: null,
      recentUpdates: [],
      recentFiles: []
    };
  }
}

// ✅ ENHANCED: Dashboard Card Component
function DashboardCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  stats 
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  stats?: {
    value: string | number;
    label: string;
  };
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700',
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-700',
    red: 'bg-red-50 border-red-200 hover:bg-red-100 text-red-700'
  };

  return (
    <Link href={href}>
      <Card className={`${colorClasses[color]} cursor-pointer transition-all duration-200 hover:shadow-md border-2`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Icon className="h-8 w-8" />
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              <p className="text-sm opacity-80 mb-3">{description}</p>
              {stats && (
                <div>
                  <p className="text-2xl font-bold">{stats.value}</p>
                  <p className="text-xs opacity-70">{stats.label}</p>
                </div>
              )}
            </div>
            <ArrowRight className="h-5 w-5 opacity-50" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ✅ ENHANCED: Quick Actions Component
function QuickActionsCard() {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {/* ✅ FIXED: Daily Activities Navigation */}
          <Link href="/client/daily-reports">
            <Button className="w-full justify-start bg-green-600 hover:bg-green-700 text-white">
              <Activity className="h-4 w-4 mr-2" />
              View Daily Activities
            </Button>
          </Link>
          
          <Link href="/client/site-schedule">
            <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
              <Calendar className="h-4 w-4 mr-2" />
              View Work Schedule
            </Button>
          </Link>
          
          <Link href="/client/messages">
            <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact Team
            </Button>
          </Link>
          
          <Link href="/client/files">
            <Button className="w-full justify-start bg-orange-600 hover:bg-orange-700 text-white">
              <FileText className="h-4 w-4 mr-2" />
              View Documents
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ✅ ENHANCED: Recent Activities Component  
function RecentActivitiesCard({ 
  recentUpdates 
}: { 
  recentUpdates: RecentUpdate[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
        <Link href="/client/daily-reports">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentUpdates && recentUpdates.length > 0 ? (
          <div className="space-y-4">
            {recentUpdates.slice(0, 5).map((update) => (
              <div key={update._id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {update.type === 'task_completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  {update.type === 'project_updated' && (
                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                  )}
                  {update.type === 'file_uploaded' && (
                    <FileText className="h-5 w-5 text-purple-500 mt-0.5" />
                  )}
                  {update.type === 'daily_report' && (
                    <Activity className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  {!['task_completed', 'project_updated', 'file_uploaded', 'daily_report'].includes(update.type) && (
                    <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {update.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {update.description}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(new Date(update.timestamp))}
                    </p>
                    {update.project && (
                      <Link href={`/client/projects/${update.project._id}`}>
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          {update.project.title}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent activities</p>
            <Link href="/client/daily-reports">
              <Button variant="outline" size="sm" className="mt-2">
                <Eye className="h-4 w-4 mr-2" />
                View Daily Reports
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ✅ ENHANCED: Active Project Component with proper typing
function ActiveProjectCard({ 
  activeProject 
}: { 
  activeProject: ActiveProject | null;
}) {
  if (!activeProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Active Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Projects</h3>
            <p className="text-gray-600 mb-4">You don&apos;t have any active projects at the moment.</p>
            <Link href="/client/projects">
              <Button variant="outline">
                View All Projects
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Active Project
          </CardTitle>
          <Badge className={getStatusColor(activeProject.status)}>
            {activeProject.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{activeProject.title}</h3>
            <p className="text-gray-700">{activeProject.description}</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Progress</span>
            <span className="text-sm font-bold text-gray-900">{activeProject.progress}%</span>
          </div>
          <div className="w-full bg-white rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${activeProject.progress}%` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Project Manager:</span>
              <span className="font-medium text-gray-900">{activeProject.manager.name}</span>
            </div>
            {activeProject.startDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Start Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(activeProject.startDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {activeProject.endDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Target Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(activeProject.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Link href={`/client/projects/${activeProject._id}`} className="flex-1">
              <Button className="w-full" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </Link>
            <Link href="/client/daily-reports" className="flex-1">
              <Button variant="outline" className="w-full" size="sm">
                <Activity className="h-4 w-4 mr-2" />
                Daily Reports
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ✅ ENHANCED: Recent Files Component
function RecentFilesCard({ 
  recentFiles 
}: { 
  recentFiles: RecentFile[];
}) {
  const getFileIcon = (category: string) => {
    switch (category) {
      case 'document': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'image': return <FileText className="h-5 w-5 text-green-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">Recent Files</CardTitle>
        <Link href="/client/files">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentFiles && recentFiles.length > 0 ? (
          <div className="space-y-3">
            {recentFiles.slice(0, 5).map((file) => (
              <div key={file._id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0">
                  {getFileIcon(file.category)}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(file.uploadedAt)}</span>
                    {file.project && (
                      <>
                        <span>•</span>
                        <span className="truncate">{file.project.title}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent files</p>
            <Link href="/client/files">
              <Button variant="outline" size="sm" className="mt-2">
                Browse Files
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {session.user.name}!
            </h1>
            <p className="text-blue-100">
              Here&apos;s an overview of your project activities
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{stats.activeProjects}</p>
            <p className="text-blue-100 text-sm">Active Projects</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeProjects}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completedProjects}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages</p>
                <p className="text-3xl font-bold text-gray-900">{stats.recentMessages}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Daily Activities"
          description="View daily progress reports and site activities"
          href="/client/daily-reports"
          icon={Activity}
          color="green"
          stats={{ value: stats.activeProjects, label: "Active Reports" }}
        />
        
        <DashboardCard
          title="Site Schedule"
          description="Check project timeline and upcoming milestones"
          href="/client/site-schedule"
          icon={Calendar}
          color="blue"
          stats={{ value: stats.activeProjects, label: "Scheduled Projects" }}
        />
        
        <DashboardCard
          title="Projects"
          description="Monitor overall project progress and updates"
          href="/client/projects"
          icon={FolderOpen}
          color="purple"
          stats={{ value: stats.totalProjects, label: "Total Projects" }}
        />
        
        <DashboardCard
          title="Team Messages"
          description="Communicate with your project team"
          href="/client/messages"
          icon={MessageCircle}
          color="orange"
          stats={{ value: stats.recentMessages, label: "Recent Messages" }}
        />
        
        <DashboardCard
          title="Documents"
          description="Access project files and documents"
          href="/client/files"
          icon={FileText}
          color="blue"
          stats={{ value: stats.totalFiles, label: "Files Available" }}
        />

        <DashboardCard
          title="Tasks"
          description="View assigned tasks and deadlines"
          href="/client/tasks"
          icon={CheckCircle}
          color="green"
          stats={{ value: stats.pendingTasks, label: "Pending Tasks" }}
        />
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Actions and Active Project */}
        <div className="lg:col-span-1 space-y-6">
          <QuickActionsCard />
          <ActiveProjectCard activeProject={activeProject} />
        </div>

        {/* Right Columns - Activities and Files */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivitiesCard recentUpdates={recentUpdates} />
          <RecentFilesCard recentFiles={recentFiles} />
        </div>
      </div>

      {/* Additional Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.completedTasks}</div>
            <div className="text-sm text-gray-600">Completed Tasks</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pendingTasks}</div>
            <div className="text-sm text-gray-600">Pending Tasks</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalFiles}</div>
            <div className="text-sm text-gray-600">Total Files</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.totalProjects > 0 ? Math.round((stats.completedProjects / stats.totalProjects) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}