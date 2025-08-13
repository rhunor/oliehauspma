// src/app/(dashboard)/manager/page.tsx - COMPLETE REAL DATA VERSION
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  FolderOpen, 
  CheckSquare, 
  Clock,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Search,
  TrendingUp,
  Users,
  FileText,
  Eye,
  Edit,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo, formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  client: {
    _id: string;
    name: string;
    email: string;
  };
  startDate?: string;
  endDate?: string;
  budget?: number;
  updatedAt: string;
  createdAt: string;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueItems: number;
}

interface RecentActivity {
  id: string;
  type: 'project_update' | 'task_completed' | 'message' | 'file_upload';
  message: string;
  timestamp: string;
  projectTitle?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'planning': return 'bg-yellow-100 text-yellow-800';
    case 'on_hold': return 'bg-orange-100 text-orange-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function ManagerDashboard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch manager-specific data
      const [statsResponse, projectsResponse, activityResponse] = await Promise.all([
        fetch('/api/analytics/manager/dashboard'),
        fetch('/api/projects?limit=6'),
        fetch('/api/analytics/manager/activity?limit=10')
      ]);

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }

      if (!projectsResponse.ok) {
        throw new Error('Failed to fetch projects');
      }

      const statsData: ApiResponse<DashboardStats> = await statsResponse.json();
      const projectsData: ApiResponse<{ data: Project[] }> = await projectsResponse.json();

      if (statsData.success) {
        setStats(statsData.data);
      }

      if (projectsData.success) {
        setProjects(projectsData.data.data || []);
      }

      // Handle activity response (might not exist yet)
      if (activityResponse.ok) {
        const activityData: ApiResponse<RecentActivity[]> = await activityResponse.json();
        if (activityData.success) {
          setRecentActivity(activityData.data);
        }
      }

    } catch (error: unknown) {
      console.error('Dashboard fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData();
    }
  }, [session?.user?.id, fetchDashboardData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/manager/projects?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchDashboardData}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'Manager'}!
          </h1>
          <p className="text-neutral-600 mt-1">
            Manage your projects and track progress effectively.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <p className="text-sm text-gray-500">Note: Only super admins can create projects</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search projects, clients, or tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">{stats.activeProjects} active</span>
                <span className="text-gray-500 ml-2">• {stats.completedProjects} completed</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Tasks</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">{stats.completedTasks} completed</span>
                <span className="text-gray-500 ml-2">• {stats.pendingTasks} pending</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.overdueItems}</p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${stats.overdueItems > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div className="mt-4 flex items-center text-sm">
                {stats.overdueItems > 0 ? (
                  <span className="text-red-600 font-medium">Requires attention</span>
                ) : (
                  <span className="text-green-600 font-medium">All on track</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">Your Projects</CardTitle>
              <Link href="/manager/projects">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
                  <p className="text-gray-600 mb-4">You haven&apos;t been assigned to any projects yet.</p>
                  <p className="text-sm text-gray-500">Contact your super admin to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div key={project._id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{project.title}</h3>
                            <Badge className={getStatusColor(project.status)}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getPriorityColor(project.priority)}>
                              {project.priority}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{project.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {project.client.name}
                            </div>
                            {project.endDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Due {formatDate(new Date(project.endDate))}
                              </div>
                            )}
                            {project.budget && (
                              <div className="flex items-center gap-1">
                                <span>₦{formatCurrency(project.budget)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${project.progress}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/manager/projects/${project._id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/manager/projects/${project._id}/edit`}>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {activity.type === 'project_update' && <FolderOpen className="h-4 w-4 text-blue-500" />}
                        {activity.type === 'task_completed' && <CheckSquare className="h-4 w-4 text-green-500" />}
                        {activity.type === 'message' && <MessageSquare className="h-4 w-4 text-purple-500" />}
                        {activity.type === 'file_upload' && <FileText className="h-4 w-4 text-orange-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.message}</p>
                        {activity.projectTitle && (
                          <p className="text-xs text-gray-500 mt-1">{activity.projectTitle}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(new Date(activity.timestamp))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/manager/site-schedule" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Site Schedule
                  </Button>
                </Link>
                <Link href="/manager/messages" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Check Messages
                  </Button>
                </Link>
                <Link href="/manager/files" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Manage Files
                  </Button>
                </Link>
                <Link href="/manager/analytics" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Analytics
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