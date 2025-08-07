// src/app/(dashboard)/admin/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { 
  Users, 
  FolderOpen, 
  CheckSquare, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  Award,
  Plus,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { formatTimeAgo, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CreateProjectModal from "@/components/projects/create-project-modal";
import Link from "next/link";

interface DashboardStats {
  projects: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
    averageProgress: number;
    totalBudget: number;
    trend: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    trend: number;
  };
  users: {
    total: number;
    active: number;
    superAdmins: number;
    projectManagers: number;
    clients: number;
    trend: number;
  };
  performance: {
    averageCompletionTime: number;
    onTimePercentage: number;
    overdueTasksTrend: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    progress: number;
    client: string;
    manager: string;
    timestamp: string;
  }>;
}

interface Project {
  _id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  priority: string;
  client: {
    name: string;
  };
  manager: {
    name: string;
  };
  endDate: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analytics data and recent projects in parallel
      const [analyticsRes, projectsRes] = await Promise.all([
        fetch('/api/analytics/dashboard'),
        fetch('/api/projects?limit=3&page=1')
      ]);

      if (!analyticsRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      if (!projectsRes.ok) {
        throw new Error('Failed to fetch projects data');
      }

      const analyticsData = await analyticsRes.json();
      const projectsData = await projectsRes.json();

      if (analyticsData.success) {
        setStats(analyticsData.data);
      } else {
        throw new Error(analyticsData.error || 'Failed to load analytics');
      }

      if (projectsData.success) {
        setRecentProjects(projectsData.data.projects);
      } else {
        throw new Error(projectsData.error || 'Failed to load projects');
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleProjectCreated = () => {
    // Refresh dashboard data after project creation
    fetchDashboardData();
    toast({
      title: "Success",
      description: "Project created successfully",
    });
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Welcome back {session?.user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-neutral-600 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </Button>
          <Button className="flex items-center gap-2" onClick={() => setShowCreateProject(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Projects"
          value={stats.projects.total}
          description={`${stats.projects.active} active`}
          icon={<FolderOpen className="h-6 w-6" />}
          trend={{ value: stats.projects.trend, isPositive: stats.projects.trend > 0 }}
        />
        <StatsCard
          title="Total Tasks"
          value={stats.tasks.total}
          description={`${stats.tasks.completionRate}% completed`}
          icon={<CheckSquare className="h-6 w-6" />}
          trend={{ value: stats.tasks.trend, isPositive: stats.tasks.trend > 0 }}
        />
        <StatsCard
          title="Active Users"
          value={stats.users.active}
          description={`${stats.users.total} total users`}
          icon={<Users className="h-6 w-6" />}
          trend={{ value: stats.users.trend, isPositive: stats.users.trend > 0 }}
        />
        <StatsCard
          title="Overdue Tasks"
          value={stats.tasks.overdue}
          description="Need attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={{ value: stats.performance.overdueTasksTrend, isPositive: stats.performance.overdueTasksTrend <= 0 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card variant="elegant">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary-600" />
                Recent Projects
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-primary-600">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <div
                    key={project._id}
                    className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:border-primary-200 transition-colors cursor-pointer"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900">{project.title}</h4>
                        <StatusBadge status={project.status} />
                        <PriorityBadge priority={project.priority} />
                      </div>
                      <p className="text-sm text-neutral-600 mb-2 line-clamp-1">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span><strong>Client:</strong> {project.client.name}</span>
                        <span><strong>Manager:</strong> {project.manager.name}</span>
                        <span><strong>Due:</strong> {formatDate(project.endDate)}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {project.progress}%
                      </div>
                      <div className="w-16 bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  No projects available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card variant="elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">
                        {activity.type === 'project_updated' ? 'Project Updated' : activity.type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {activity.title} - {activity.progress}% complete
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">
                          by {activity.manager}
                        </span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500">
                          {formatTimeAgo(new Date(activity.timestamp))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-neutral-500">
                  No recent activity
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-4 text-primary-600">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card variant="elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link href="/admin/users">
              <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                <Users className="h-6 w-6" />
                <span className="text-sm">Add User</span>
              </Button>
            </Link>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => setShowCreateProject(true)}>
              <FolderOpen className="h-6 w-6" />
              <span className="text-sm">New Project</span>
            </Button>
            <Link href="/admin/tasks">
              <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                <CheckSquare className="h-6 w-6" />
                <span className="text-sm">Assign Task</span>
              </Button>
            </Link>
            <Link href="/admin/analytics">
              <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                <TrendingUp className="h-6 w-6" />
                <span className="text-sm">View Reports</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Project Completion Rate</span>
                <span className="text-primary-600 font-semibold">
                  {stats.projects.total > 0 ? Math.round((stats.projects.completed / stats.projects.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${stats.projects.total > 0 ? Math.round((stats.projects.completed / stats.projects.total) * 100) : 0}%` 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Task Completion Rate</span>
                <span className="text-green-600 font-semibold">
                  {stats.tasks.completionRate}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats.tasks.completionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">On-Time Delivery</span>
                <span className="text-blue-600 font-semibold">
                  {stats.performance.onTimePercentage}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats.performance.onTimePercentage}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Average Completion Time</span>
                <span className="text-neutral-600">
                  {stats.performance.averageCompletionTime} days
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}