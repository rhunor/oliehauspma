// src/app/(dashboard)/manager/page.tsx - UPDATED: Mobile-first design with app-style cards
import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, 
  Calendar, 
  Target, 
  ChevronRight, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  FileText,
  MessageSquare,
  Users,
  TrendingUp,
  FolderOpen,
  PlusCircle,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

// Helper function to format time from date string (proper TypeScript)
function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid time';
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid time';
  }
}

// Proper TypeScript interfaces
interface ManagerStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProgress: number;
  totalTasks: number;
  completedTasks: number;
  clientCount: number;
  recentMessages: number;
  totalFiles: number;
  totalIncidents: number;
  activeRisks: number;
}

interface ProjectSummary {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  clientName: string;
  createdAt: string;
  updatedAt: string;
}

interface RecentUpdate {
  _id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  projectTitle?: string;
}

interface RecentFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  category: string;
  projectTitle: string;
  uploadedBy: {
    name: string;
  };
  createdAt: string;
}

interface WorkScheduleItem {
  _id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  startDate: string;
  contractor?: string;
  projectTitle: string;
}

interface DashboardData {
  stats: ManagerStats;
  recentProjects: ProjectSummary[];
  recentUpdates: RecentUpdate[];
  recentFiles: RecentFile[];
  workSchedule: {
    todayTasks: WorkScheduleItem[];
    upcomingTasks: WorkScheduleItem[];
    totalTasks: number;
    completedToday: number;
  };
}

// MongoDB document interfaces (proper typing)
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  client: ObjectId;
  manager: ObjectId;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
}

// Mobile App Style Dashboard Card Component (NEW - for mobile only)
interface MobileDashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink';
  stats?: {
    value: number | string;
    label: string;
  };
  subtitle?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}

function MobileDashboardCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  stats,
  subtitle,
  isEmpty = false,
  emptyMessage 
}: MobileDashboardCardProps) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { 
      bg: 'bg-blue-50 hover:bg-blue-100', 
      icon: 'text-blue-600', 
      text: 'text-blue-700' 
    },
    green: { 
      bg: 'bg-green-50 hover:bg-green-100', 
      icon: 'text-green-600', 
      text: 'text-green-700' 
    },
    purple: { 
      bg: 'bg-purple-50 hover:bg-purple-100', 
      icon: 'text-purple-600', 
      text: 'text-purple-700' 
    },
    orange: { 
      bg: 'bg-orange-50 hover:bg-orange-100', 
      icon: 'text-orange-600', 
      text: 'text-orange-700' 
    },
    red: { 
      bg: 'bg-red-50 hover:bg-red-100', 
      icon: 'text-red-600', 
      text: 'text-red-700' 
    },
    pink: { 
      bg: 'bg-pink-50 hover:bg-pink-100', 
      icon: 'text-pink-600', 
      text: 'text-pink-700' 
    }
  };

  const colors = colorClasses[color];

  return (
    <Link href={href}>
      <Card className={`${colors.bg} border-0 hover:shadow-md transition-all duration-200 cursor-pointer group h-full lg:hidden`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-full bg-white shadow-sm`}>
                <Icon className={`h-8 w-8 ${colors.icon}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-bold text-lg ${colors.text}`}>{title}</h3>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isEmpty ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <Icon className="h-12 w-12 mx-auto opacity-50" />
                </div>
                <p className="text-gray-500 text-sm font-medium">{emptyMessage}</p>
              </div>
            ) : (
              <>
                {stats && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl font-bold ${colors.text}`}>{stats.value}</p>
                      <p className="text-sm text-gray-600">{stats.label}</p>
                    </div>
                  </div>
                )}
                
                <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Original Dashboard Card Component (preserved for desktop)
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
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full hidden lg:block">
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

// Database functions (proper TypeScript, following project patterns)
async function getManagerDashboardData(managerId: string): Promise<DashboardData> {
  try {
    const { db } = await connectToDatabase();

    // Get manager's projects with proper filter typing
    const projectQuery: Filter<ProjectDocument> = {
      manager: new ObjectId(managerId)
    };

    const projects = await db.collection<ProjectDocument>('projects')
      .find(projectQuery)
      .toArray();

    const projectIds = projects.map(p => p._id);

    // Calculate statistics
    const stats: ManagerStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      averageProgress: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
      totalTasks: 0,
      completedTasks: 0,
      clientCount: 0,
      recentMessages: 0,
      totalFiles: 0,
      totalIncidents: 0,
      activeRisks: 0
    };

    // Get unique clients
    const uniqueClientIds = [...new Set(projects.map(p => p.client))];
    stats.clientCount = uniqueClientIds.length;

    // Get recent project data with client names
    const recentProjects: ProjectSummary[] = [];
    for (const project of projects.slice(0, 5)) {
      const client = await db.collection<UserDocument>('users').findOne({ _id: project.client });
      recentProjects.push({
        _id: project._id.toString(),
        title: project.title,
        description: project.description,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        clientName: client?.name || 'Unknown Client',
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      });
    }

    // Get recent updates
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
        title: `Project ${project.status === 'completed' ? 'completed' : 'updated'}`,
        description: project.title,
        timestamp: project.updatedAt.toISOString(),
        projectTitle: project.title
      }));

    // Get recent files
    const recentFiles = await db.collection('files')
      .find({
        projectId: { $in: projectIds }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const transformedRecentFiles: RecentFile[] = [];
    for (const file of recentFiles) {
      const project = projects.find(p => p._id.equals(file.projectId));
      const uploader = await db.collection('users').findOne({ _id: file.uploadedBy });
      
      transformedRecentFiles.push({
        _id: file._id.toString(),
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        category: file.category,
        projectTitle: project?.title || 'Unknown Project',
        uploadedBy: {
          name: uploader?.name || 'Unknown User'
        },
        createdAt: file.createdAt.toISOString()
      });
    }

    // Get work schedule data (mock for now)
    const workSchedule = {
      todayTasks: [] as WorkScheduleItem[],
      upcomingTasks: [] as WorkScheduleItem[],
      totalTasks: 0,
      completedToday: 0
    };

    return {
      stats,
      recentProjects,
      recentUpdates,
      recentFiles: transformedRecentFiles,
      workSchedule
    };

  } catch (error) {
    console.error('Error fetching manager dashboard data:', error);
    
    // Return default values on error
    return {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        averageProgress: 0,
        totalTasks: 0,
        completedTasks: 0,
        clientCount: 0,
        recentMessages: 0,
        totalFiles: 0,
        totalIncidents: 0,
        activeRisks: 0
      },
      recentProjects: [],
      recentUpdates: [],
      recentFiles: [],
      workSchedule: {
        todayTasks: [],
        upcomingTasks: [],
        totalTasks: 0,
        completedToday: 0
      }
    };
  }
}

// Loading component
function ManagerDashboardLoading() {
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

  const {
    stats,
    recentProjects,
    recentUpdates,
    recentFiles,
    workSchedule
  } = await getManagerDashboardData(session.user.id);

  return (
    <>
      <div className="space-y-6">
        {/* Header with Mobile-First Design */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              <span className="lg:hidden">Home</span>
              <span className="hidden lg:block">Manager Dashboard</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              <span className="lg:hidden">Welcome back, {session.user.name?.split(' ')[0]}!</span>
              <span className="hidden lg:block">Manage your projects and track progress</span>
            </p>
          </div>
          
          {/* Quick Action Button */}
          <div className="lg:flex-shrink-0">
            <Link href="/manager/projects/new">
              <Button className="w-full lg:w-auto min-h-[44px] touch-manipulation">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Cards - NEW: Mobile app style cards (mobile only) */}
        <div className="lg:hidden space-y-4">
          {/* Primary Cards - Always visible */}
          <div className="grid grid-cols-1 gap-4">
            {/* Project Management Card */}
            <MobileDashboardCard
              title="My Projects"
              description="Manage and track your assigned projects"
              href="/manager/projects"
              icon={FolderOpen}
              color="blue"
              stats={{ 
                value: stats.activeProjects, 
                label: "Active Projects" 
              }}
              subtitle="Project Management"
            />

            {/* Site Schedule Card */}
            <MobileDashboardCard
              title="Site Schedule"
              description="Monitor project timeline and upcoming activities"
              href="/manager/site-schedule"
              icon={Calendar}
              color="green"
              stats={{ 
                value: workSchedule.totalTasks, 
                label: "Scheduled Tasks" 
              }}
              subtitle="Work Schedule"
            />
          </div>

          {/* Secondary Cards - Shown when scrolling */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            {/* Team Analytics Card */}
            <MobileDashboardCard
              title="Team Analytics"
              description="View project performance and team metrics"
              href="/manager/analytics"
              icon={BarChart3}
              color="purple"
              stats={{ 
                value: `${stats.averageProgress}%`, 
                label: "Avg Progress" 
              }}
              subtitle="Performance Metrics"
            />

            {/* Client Communication Card */}
            <MobileDashboardCard
              title="Client Messages"
              description="Communicate with your project clients"
              href="/manager/messages"
              icon={MessageSquare}
              color="orange"
              stats={{ 
                value: stats.recentMessages, 
                label: "Recent Messages" 
              }}
              subtitle="Team Communication"
            />

            {/* Project Files Card */}
            <MobileDashboardCard
              title="Project Files"
              description="Access project documents and files"
              href="/manager/files"
              icon={FileText}
              color="pink"
              stats={{ 
                value: recentFiles.length, 
                label: "Recent Files" 
              }}
              subtitle="Documents & Media"
            />

            {/* Team Management Card */}
            <MobileDashboardCard
              title="Team Overview"
              description="Manage clients and project assignments"
              href="/manager/team"
              icon={Users}
              color="red"
              stats={{ 
                value: stats.clientCount, 
                label: "Active Clients" 
              }}
              subtitle="Team Management"
            />
          </div>
        </div>

        {/* Enhanced Header for desktop */}
        <div className="hidden lg:block bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {session.user.name}!
              </h2>
              <p className="text-green-100">
                Manage your projects and keep clients updated with real-time progress
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{stats.totalProjects}</p>
              <p className="text-green-100 text-sm">Total Projects</p>
            </div>
          </div>
        </div>

        {/* Updated Dashboard Cards with new features (desktop only) */}
        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="Project Management"
            description="View, create, and manage all your assigned projects"
            href="/manager/projects"
            icon={FolderOpen}
            color="blue"
            stats={{ value: stats.totalProjects, label: "Total Projects" }}
          />
          
          <DashboardCard
            title="Site Schedule"
            description="Monitor project timeline, milestones, and daily activities"
            href="/manager/site-schedule"
            icon={Calendar}
            color="green"
            stats={{ value: workSchedule.totalTasks, label: "Scheduled Tasks" }}
          />
          
          <DashboardCard
            title="Team Analytics"
            description="Track project performance and team productivity metrics"
            href="/manager/analytics"
            icon={BarChart3}
            color="purple"
            stats={{ value: stats.averageProgress, label: "Avg Progress %" }}
          />
        </div>

        {/* Dashboard Grid - DESKTOP ONLY */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Key Metrics */}
          <div className="lg:col-span-1 space-y-6">
            {/* Key Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.activeProjects}</div>
                    <div className="text-sm text-gray-500">Active Projects</div>
                  </div>
                  
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.completedProjects}</div>
                    <div className="text-sm text-gray-500">Completed</div>
                  </div>
                  
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{stats.clientCount}</div>
                    <div className="text-sm text-gray-500">Active Clients</div>
                  </div>
                  
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{stats.averageProgress}%</div>
                    <div className="text-sm text-gray-500">Avg Progress</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/manager/projects/new">
                  <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Project
                  </Button>
                </Link>
                
                <Link href="/manager/site-schedule">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Schedule
                  </Button>
                </Link>

                <Link href="/manager/messages">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Check Messages
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-blue-600" />
                  Recent Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentProjects.length > 0 ? (
                  <div className="space-y-3">
                    {recentProjects.slice(0, 5).map((project) => (
                      <div key={project._id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${
                            project.status === 'completed' ? 'bg-green-500' :
                            project.status === 'in_progress' ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`}></div>
                        </div>
                        <div className="flex-grow min-w-0">
                          <Link href={`/manager/projects/${project._id}`}>
                            <p className="text-sm font-medium text-gray-900 truncate hover:text-blue-600">
                              {project.title}
                            </p>
                          </Link>
                          <p className="text-xs text-gray-500 truncate">
                            Client: {project.clientName}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(new Date(project.updatedAt))}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {project.progress}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FolderOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No projects yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Files */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Recent Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentFiles.length > 0 ? (
                  <div className="space-y-3">
                    {recentFiles.slice(0, 5).map((file) => (
                      <div key={file._id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-shrink-0">
                          <FileText className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {file.projectTitle} • {file.uploadedBy.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(new Date(file.createdAt))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No recent files</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

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

      {/* Floating AI Chatbot */}
      <Suspense fallback={null}>
        <div className="fixed bottom-4 right-4 z-[1000]">
          <FloatingAIChatbot />
        </div>
      </Suspense>
    </>
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