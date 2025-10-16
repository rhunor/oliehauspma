// src/app/(dashboard)/admin/page.tsx - UPDATED: Mobile-first design with app-style cards
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
  BarChart3,
  Settings,
  Database
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
interface AdminStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalUsers: number;
  totalClients: number;
  totalManagers: number;
  totalAdmins: number;
  recentActivities: Array<{
    _id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date;
  }>;
  usersByRole: {
    super_admin: number;
    project_manager: number;
    client: number;
  };
  projectsByStatus: Record<string, number>;
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    uptime: string;
    responseTime: number;
  };
}

interface RecentUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

interface SystemMetric {
  _id: string;
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  timestamp: string;
}

interface DashboardData {
  stats: AdminStats;
  recentUsers: RecentUser[];
  systemMetrics: SystemMetric[];
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
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  const iconColorClasses: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600'
  };
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group h-full hidden lg:block border border-gray-100">
        <CardContent className="p-0">
          {/* CHANGED: Removed gradient, now clean white with subtle shadow */}
          <div className="bg-white p-6 relative overflow-hidden border-b border-gray-100">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-10">
              <Icon className={`h-24 w-24 transform rotate-12 ${iconColorClasses[color]}`} />
            </div>
            <div className="relative">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Icon className={`h-6 w-6 ${iconColorClasses[color]}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
                  {stats && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-2xl font-bold text-gray-900">{stats.value}</span>
                      <span className="text-sm text-gray-600">{stats.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white">
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

// Helper functions for activity icons and status colors
function getActivityIcon(type: string) {
  switch (type) {
    case 'user_created':
      return <Users className="h-4 w-4 text-green-500" />;
    case 'project_created':
      return <FolderOpen className="h-4 w-4 text-blue-500" />;
    case 'project_completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'system_alert':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusColor(status: string): string {
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
}

// Database functions (proper TypeScript, following project patterns)
async function getAdminDashboardData(): Promise<DashboardData> {
  try {
    const { db } = await connectToDatabase();

    // Get all projects
    const projects = await db.collection<ProjectDocument>('projects')
      .find({})
      .toArray();

    // Get all users
    const users = await db.collection<UserDocument>('users')
      .find({})
      .toArray();

    // Calculate statistics
    const stats: AdminStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalUsers: users.length,
      totalClients: users.filter(u => u.role === 'client').length,
      totalManagers: users.filter(u => u.role === 'project_manager').length,
      totalAdmins: users.filter(u => u.role === 'super_admin').length,
      recentActivities: [],
      usersByRole: {
        super_admin: users.filter(u => u.role === 'super_admin').length,
        project_manager: users.filter(u => u.role === 'project_manager').length,
        client: users.filter(u => u.role === 'client').length
      },
      projectsByStatus: projects.reduce((acc, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      systemHealth: {
        status: 'healthy' as const,
        uptime: '99.9%',
        responseTime: 150
      }
    };

    // Get recent activities from project and user updates
    const recentActivities = [];
    
    // Add recent project updates
    const recentProjectUpdates = projects
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)
      .map(project => ({
        _id: project._id.toString(),
        type: project.status === 'completed' ? 'project_completed' : 'project_updated',
        title: `Project ${project.status === 'completed' ? 'completed' : 'updated'}`,
        description: project.title,
        timestamp: project.updatedAt
      }));

    // Add recent user registrations
    const recentUserCreations = users
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3)
      .map(user => ({
        _id: user._id.toString(),
        type: 'user_created',
        title: 'New user registered',
        description: `${user.name} (${user.role})`,
        timestamp: user.createdAt
      }));

    stats.recentActivities = [...recentProjectUpdates, ...recentUserCreations]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Get recent users
    const recentUsers: RecentUser[] = users
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(user => ({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive
      }));

    // Mock system metrics
    const systemMetrics: SystemMetric[] = [
      {
        _id: '1',
        name: 'Database Performance',
        value: 98,
        unit: '%',
        status: 'good' as const,
        timestamp: new Date().toISOString()
      },
      {
        _id: '2',
        name: 'Server Response Time',
        value: 150,
        unit: 'ms',
        status: 'good' as const,
        timestamp: new Date().toISOString()
      },
      {
        _id: '3',
        name: 'Active Connections',
        value: 45,
        unit: 'connections',
        status: 'good' as const,
        timestamp: new Date().toISOString()
      }
    ];

    return {
      stats,
      recentUsers,
      systemMetrics
    };

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    
    // Return default values on error
    return {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalUsers: 0,
        totalClients: 0,
        totalManagers: 0,
        totalAdmins: 0,
        recentActivities: [],
        usersByRole: {
          super_admin: 0,
          project_manager: 0,
          client: 0
        },
        projectsByStatus: {},
        systemHealth: {
          status: 'healthy' as const,
          uptime: '99.9%',
          responseTime: 150
        }
      },
      recentUsers: [],
      systemMetrics: []
    };
  }
}

// Loading component
function AdminDashboardLoading() {
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

  const {
    stats,
    recentUsers,
    systemMetrics
  } = await getAdminDashboardData();

  return (
    <>
      <div className="space-y-6">
        {/* Header with Mobile-First Design */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              <span className="lg:hidden">Home</span>
              <span className="hidden lg:block">Admin Dashboard</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              <span className="lg:hidden">Welcome back, {session.user.name?.split(' ')[0]}!</span>
              <span className="hidden lg:block">System overview and management console</span>
            </p>
          </div>
          
          {/* System Status Indicator */}
          <div className="lg:flex-shrink-0">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              stats.systemHealth.status === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : stats.systemHealth.status === 'warning'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                stats.systemHealth.status === 'healthy' 
                  ? 'bg-green-500' 
                  : stats.systemHealth.status === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">System {stats.systemHealth.status}</span>
            </div>
          </div>
        </div>

        {/* Mobile Cards - NEW: Mobile app style cards (mobile only) */}
        <div className="lg:hidden space-y-4">
          {/* Primary Cards - Always visible */}
          <div className="grid grid-cols-1 gap-4">
            {/* User Management Card */}
            <MobileDashboardCard
              title="User Management"
              description="Manage users, roles, and permissions across the platform"
              href="/admin/users"
              icon={Users}
              color="blue"
              stats={{ 
                value: stats.totalUsers, 
                label: "Total Users" 
              }}
              subtitle="System Administration"
            />

            {/* Project Overview Card */}
            <MobileDashboardCard
              title="Project Overview"
              description="Monitor all projects and their current status"
              href="/admin/projects"
              icon={FolderOpen}
              color="green"
              stats={{ 
                value: stats.activeProjects, 
                label: "Active Projects" 
              }}
              subtitle="Project Management"
            />
          </div>

          {/* Secondary Cards - Shown when scrolling */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            {/* System Analytics Card */}
            <MobileDashboardCard
              title="System Analytics"
              description="View comprehensive system metrics and reports"
              href="/admin/analytics"
              icon={BarChart3}
              color="purple"
              stats={{ 
                value: `${stats.systemHealth.responseTime}ms`, 
                label: "Avg Response Time" 
              }}
              subtitle="Performance Metrics"
            />

            {/* System Settings Card */}
            <MobileDashboardCard
              title="System Settings"
              description="Configure global settings and preferences"
              href="/admin/settings"
              icon={Settings}
              color="orange"
              stats={{ 
                value: stats.systemHealth.uptime, 
                label: "System Uptime" 
              }}
              subtitle="Configuration"
            />

            {/* File Management Card */}
            <MobileDashboardCard
              title="File Management"
              description="Monitor and manage uploaded files across projects"
              href="/admin/files"
              icon={FileText}
              color="pink"
              subtitle="Document Management"
            />

            {/* Database Management Card removed: route /admin/database does not exist */}
          </div>
        </div>

        {/* Enhanced Header for desktop - modern SaaS neutral card */}
        <div className="hidden lg:block bg-white rounded-lg p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">
                Welcome back, {session.user.name}!
              </h2>
              <p className="text-gray-600">
                Oversee all system operations and maintain platform performance
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-gray-600 text-sm">Total Users</p>
            </div>
          </div>
        </div>

        {/* KPI Row - desktop only */}
        <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500">Active Projects</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{stats.activeProjects}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500">System Health</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{stats.systemHealth.status}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500">Response Time</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{stats.systemHealth.responseTime}ms</p>
          </div>
        </div>

        {/* Updated Dashboard Cards with new features (desktop only) */}
        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="User Management"
            description="Manage users, roles, and permissions across the platform"
            href="/admin/users"
            icon={Users}
            color="blue"
            stats={{ value: stats.totalUsers, label: "Total Users" }}
          />
          
          <DashboardCard
            title="System Analytics"
            description="Monitor system performance, usage metrics, and reports"
            href="/admin/analytics"
            icon={BarChart3}
            color="green"
            stats={{ value: stats.totalProjects, label: "Total Projects" }}
          />
          
          <DashboardCard
            title="Project Overview"
            description="View and manage all projects across the platform"
            href="/admin/projects"
            icon={FolderOpen}
            color="purple"
            stats={{ value: stats.activeProjects, label: "Active Projects" }}
          />
        </div>

        {/* Key Metrics Cards - Mobile responsive grid */}
        <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Total Users */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {stats.totalClients} clients, {stats.totalManagers} managers
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.activeProjects}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats.completedProjects} completed
                  </p>
                </div>
                <FolderOpen className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-sm font-medium text-gray-600">System Health</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.systemHealth.uptime}</p>
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-600">Healthy</span>
                    </div>
                  </div>
                </div>
                <Shield className="h-8 w-8 text-purple-600 ml-4" />
              </div>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Response</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.systemHealth.responseTime}ms</p>
                  <p className="text-xs text-green-600 mt-1">
                    Performance good
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Grid - DESKTOP ONLY */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - System Overview */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  User Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Project Managers</span>
                    <span className="font-semibold text-green-600">{stats.usersByRole.project_manager}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Clients</span>
                    <span className="font-semibold text-purple-600">{stats.usersByRole.client}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Project Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.projectsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(status)}>
                          {status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white border border-gray-100 shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900">
      <Settings className="h-5 w-5 text-gray-600" />
      Quick Actions
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    <Link href="/admin/users/new">
      <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
        <PlusCircle className="h-4 w-4 mr-2" />
        Create New User
      </Button>
    </Link>
    
    <Link href="/admin/analytics">
      <Button variant="outline" className="w-full justify-start border-gray-200 hover:bg-gray-50">
        <BarChart3 className="h-4 w-4 mr-2" />
        View Analytics
      </Button>
    </Link>

    <Link href="/admin/settings">
      <Button variant="outline" className="w-full justify-start border-gray-200 hover:bg-gray-50">
        <Settings className="h-4 w-4 mr-2" />
        System Settings
      </Button>
    </Link>
  </CardContent>
</Card>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Recent Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentActivities.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentActivities.slice(0, 6).map((activity) => (
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
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No recent activities</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Users */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Recent Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentUsers.length > 0 ? (
                  <div className="space-y-3">
                    {recentUsers.slice(0, 5).map((user) => (
                      <div key={user._id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-grow min-w-0">
                          <Link href={`/admin/users/${user._id}`}>
                            <p className="text-sm font-medium text-gray-900 truncate hover:text-blue-600">
                              {user.name}
                            </p>
                          </Link>
                          <div className="flex items-center space-x-2">
                            <p className="text-xs text-gray-500 truncate">
                              {user.email}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Joined {formatTimeAgo(new Date(user.createdAt))}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full ${
                            user.isActive ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No recent users</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                  System Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemMetrics.map((metric) => (
                    <div key={metric._id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                        <p className="text-xs text-gray-500">
                          Last updated: {formatTimeAgo(new Date(metric.timestamp))}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-gray-900">
                          {metric.value}{metric.unit}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          metric.status === 'good' ? 'bg-green-500' :
                          metric.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
export default async function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardLoading />}>
      <AdminDashboard />
    </Suspense>
  );
} 