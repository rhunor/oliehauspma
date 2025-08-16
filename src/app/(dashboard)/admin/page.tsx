// src/app/(dashboard)/admin/page.tsx - ENHANCED RESPONSIVE ADMIN DASHBOARD
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Users, 
  FolderOpen, 
  MessageSquare, 
  BarChart3,
  TrendingUp,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  Eye,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
  totalUsers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalMessages: number;
  unreadMessages: number;
  recentActivities: Activity[];
  projectStats: ProjectStat[];
}

interface Activity {
  id: string;
  type: 'user_created' | 'project_created' | 'project_completed' | 'message_sent';
  title: string;
  description: string;
  timestamp: string;
  user: {
    name: string;
    role: string;
  };
}

interface ProjectStat {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
  dueDate: string;
  client: string;
  manager: string;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [_isTablet, setIsTablet] = useState(false);

  // Enhanced viewport detection
  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Simulate API call - replace with actual endpoint
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data - replace with actual API call
        const mockStats: DashboardStats = {
          totalUsers: 127,
          totalProjects: 45,
          activeProjects: 23,
          completedProjects: 18,
          totalMessages: 1543,
          unreadMessages: 12,
          recentActivities: [
            {
              id: '1',
              type: 'project_created',
              title: 'New Project Created',
              description: 'Modern Villa Construction project has been created',
              timestamp: '2 hours ago',
              user: { name: 'John Smith', role: 'project_manager' }
            },
            {
              id: '2',
              type: 'user_created',
              title: 'New User Registered',
              description: 'Sarah Johnson joined as a client',
              timestamp: '4 hours ago',
              user: { name: 'Admin', role: 'super_admin' }
            },
            {
              id: '3',
              type: 'project_completed',
              title: 'Project Completed',
              description: 'Luxury Apartment Renovation has been completed',
              timestamp: '1 day ago',
              user: { name: 'Mike Davis', role: 'project_manager' }
            }
          ],
          projectStats: [
            {
              id: '1',
              title: 'Modern Villa Construction',
              status: 'active',
              progress: 75,
              dueDate: '2024-03-15',
              client: 'Robert Wilson',
              manager: 'John Smith'
            },
            {
              id: '2',
              title: 'Office Building Renovation',
              status: 'active',
              progress: 45,
              dueDate: '2024-04-20',
              client: 'Tech Corp Ltd',
              manager: 'Jane Doe'
            },
            {
              id: '3',
              title: 'Residential Complex',
              status: 'completed',
              progress: 100,
              dueDate: '2024-02-28',
              client: 'City Development',
              manager: 'Mike Davis'
            }
          ]
        };
        
        setStats(mockStats);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_created':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'project_created':
        return <FolderOpen className="h-4 w-4 text-green-500" />;
      case 'project_completed':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'message_sent':
        return <MessageSquare className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          {/* Loading header */}
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </div>
          
          {/* Loading stats cards */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load dashboard</h3>
          <p className="text-gray-600">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {session?.user?.name}. Here&apos;s what&apos;s happening with your projects.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            <Eye className="h-4 w-4 mr-2" />
            {isMobile ? 'Schedule' : 'View Complete Site Schedule'}
          </Button>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? 'New Project' : 'Create Project'}
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-green-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +12% from last month
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.activeProjects}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalProjects} total projects
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <FolderOpen className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalMessages}</p>
                <p className="text-xs text-orange-600 mt-1">
                  {stats.unreadMessages} unread
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <MessageSquare className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {Math.round((stats.completedProjects / stats.totalProjects) * 100)}%
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {stats.completedProjects} completed
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activities */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
              <Button variant="ghost" size="sm">
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">by {activity.user.name}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{activity.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t">
              <Link 
                href="/admin/activities" 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                View all activities
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Project Overview */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Project Overview</CardTitle>
              <Link href="/admin/projects">
                <Button variant="ghost" size="sm">
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.projectStats.slice(0, 3).map((project) => (
              <div key={project.id} className="space-y-3 p-3 rounded-lg border hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {project.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Client: {project.client}
                    </p>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                    {project.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due: {formatDate(project.dueDate)}
                  </span>
                  <span>PM: {project.manager}</span>
                </div>
              </div>
            ))}
            
            <div className="pt-2">
              <Link 
                href="/admin/projects" 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                View all projects
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      {isMobile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/users">
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <Users className="h-5 w-5" />
                  <span className="text-xs">Users</span>
                </Button>
              </Link>
              <Link href="/admin/projects">
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <FolderOpen className="h-5 w-5" />
                  <span className="text-xs">Projects</span>
                </Button>
              </Link>
              <Link href="/admin/messages">
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-xs">Messages</span>
                </Button>
              </Link>
              <Link href="/admin/analytics">
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">Analytics</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}