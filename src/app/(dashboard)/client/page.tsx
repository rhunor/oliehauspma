// src/app/(dashboard)/client/page.tsx - MODIFIED: Removed Analytics Cards & Specific Dashboard Cards
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import Link from 'next/link';
import { 
  Activity,
  Calendar,
  FolderOpen,
  TrendingUp,
  CheckCircle,
  MessageCircle,
  FileText,
  ChevronRight,
  Eye,
  Clock,
  Download,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

// TypeScript interfaces following best practices - avoiding 'any' type
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

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  client: ObjectId;
  manager: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface ActiveProject {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
}

interface RecentUpdate {
  _id: string;
  type: 'project_updated' | 'project_completed';
  title: string;
  description: string;
  timestamp: string;
  project: {
    _id: string;
    title: string;
  };
}

interface RecentFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  category: string;
  uploadedAt: Date;
  uploadedBy: {
    name: string;
  };
  project: {
    title: string;
  };
}

interface DashboardData {
  stats: ClientStats;
  activeProject: ActiveProject | null;
  recentUpdates: RecentUpdate[];
  recentFiles: RecentFile[];
}

// Server function to fetch client dashboard data
async function getClientDashboardData(clientId: string): Promise<DashboardData> {
  try {
    const { db } = await connectToDatabase();

    // Get client's projects with proper filter typing
    const projectQuery: Filter<ProjectDocument> = {
      client: new ObjectId(clientId)
    };

    const projects = await db.collection<ProjectDocument>('projects')
      .find(projectQuery)
      .toArray();

    const projectIds = projects.map(p => p._id);

    // Calculate statistics
    const stats: ClientStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      recentMessages: 0,
      totalFiles: 0
    };

    // Get the most active project
    let activeProject: ActiveProject | null = null;
    const currentActiveProject = projects
      .filter(p => p.status === 'in_progress')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    if (currentActiveProject) {
      activeProject = {
        _id: currentActiveProject._id.toString(),
        title: currentActiveProject.title,
        description: currentActiveProject.description,
        status: currentActiveProject.status,
        priority: currentActiveProject.priority,
        progress: currentActiveProject.progress
      };
    }

    // Get recent project updates
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const recentUpdates: RecentUpdate[] = projects
      .filter(project => project.updatedAt >= startOfMonth)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map(project => ({
        _id: project._id.toString(),
        type: project.status === 'completed' ? 'project_completed' : 'project_updated',
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

// Dashboard Card Component with proper TypeScript typing
interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  stats?: {
    value: number;
    label: string;
  };
}

function DashboardCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  stats 
}: DashboardCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    red: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
  };

  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full">
        <CardContent className="p-0">
          <div className={`bg-gradient-to-br ${colorClasses[color]} p-6 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-20">
              <Icon className="h-24 w-24 transform rotate-12" />
            </div>
            <div className="relative">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  {stats && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-2xl font-bold">{stats.value}</span>
                      <span className="text-sm opacity-90">{stats.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                View Details
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function getFileIcon(category: string) {
  const iconMap: Record<string, React.ReactElement> = {
    image: <FileText className="h-5 w-5 text-blue-500" />,
    video: <FileText className="h-5 w-5 text-red-500" />,
    audio: <FileText className="h-5 w-5 text-green-500" />,
    document: <FileText className="h-5 w-5 text-purple-500" />,
    other: <FileText className="h-5 w-5 text-gray-500" />
  };
  return iconMap[category] || iconMap.other;
}

function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return priorityColors[priority] || 'bg-gray-100 text-gray-800';
}

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    on_hold: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}

// Active Project Component
function ActiveProjectCard({ project }: { project: ActiveProject | null }) {
  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            Active Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No active projects at the moment</p>
            <Link href="/client/projects">
              <Button variant="outline" size="sm" className="mt-4">
                Browse All Projects
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-blue-600" />
          Active Project
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">{project.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{project.description}</p>
          
          <div className="flex items-center gap-2 mb-3">
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace('_', ' ')}
            </Badge>
            <Badge className={getPriorityColor(project.priority)}>
              {project.priority}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>
        </div>
        
        <Link href={`/client/projects/${project._id}`}>
          <Button className="w-full" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Recent Updates Component
function RecentUpdatesCard({ updates }: { updates: RecentUpdate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-600" />
          Recent Updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {updates.length > 0 ? (
          <div className="space-y-3">
            {updates.slice(0, 5).map((update) => (
              <div key={update._id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0 mt-1">
                  {update.type === 'project_completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Activity className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {update.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {update.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeAgo(new Date(update.timestamp))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Files Component
function RecentFilesCard({ files }: { files: RecentFile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          Recent Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length > 0 ? (
          <div className="space-y-3">
            {files.slice(0, 5).map((file) => (
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
    <>
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

        {/* Enhanced Dashboard Cards - ONLY removing specified cards and making requested changes */}
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
            description="Monitor overall project progress and updates"
            href="/client/site-schedule"
            icon={Calendar}
            color="blue"
            stats={{ value: stats.activeProjects, label: "Scheduled Projects" }}
          />
          
          <DashboardCard
            title="Project Milestone"
            description="Check project timeline and upcoming milestones"
            href="/client/projects"
            icon={FolderOpen}
            color="purple"
            stats={{ value: stats.totalProjects, label: "Total Projects" }}
          />

          {/* REMOVED: Team Messages, Documents, Tasks cards as requested */}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Quick Actions and Active Project */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {/* View Work Schedule - Updated as requested */}
                  <Link href="/client/site-schedule">
                    <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
                      <Calendar className="h-4 w-4 mr-2" />
                      View Work Schedule
                    </Button>
                  </Link>
                  
                  {/* Contact Team */}
                  <Link href="/client/messages">
                    <Button variant="outline" className="w-full justify-start">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Contact Team
                    </Button>
                  </Link>
                  
                  {/* View All Projects */}
                  <Link href="/client/projects">
                    <Button variant="outline" className="w-full justify-start">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      View All Projects
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Active Project */}
            <ActiveProjectCard project={activeProject} />
          </div>

          {/* Right Column - Recent Activities */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentUpdatesCard updates={recentUpdates} />
              <RecentFilesCard files={recentFiles} />
            </div>
          </div>
        </div>
      </div>

      {/* KEPT: Floating AI Chatbot - positioned in bottom-right corner as original */}
      <FloatingAIChatbot className="bottom-6 right-6" />
    </>
  );
}