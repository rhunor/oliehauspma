// src/app/(dashboard)/admin/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  FolderOpen, 
  ClipboardList,
  Users, 
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  Activity,
  CalendarCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/utils";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { useToast } from "@/hooks/use-toast";

// Define proper interfaces for dashboard data
interface DashboardStats {
  projects: {
    total: number;
    active: number;
    trend: number;
    averageProgress: number;
  };
  tasks: {
    total: number;
    completionRate: number;
    trend: number;
    overdue: number;
  };
  users: {
    active: number;
    total: number;
    trend: number;
  };
  performance: {
    onTimePercentage: number;
    averageCompletionTime: number;
    overdueTasksTrend: number;
  };
  recentActivity: ProjectActivity[];
}

interface ProjectActivity {
  id: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  timestamp: string;
}

interface DashboardApiResponse {
  success: boolean;
  data: DashboardStats;
  error?: string;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectActivity[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics/dashboard');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }
      
      const data: DashboardApiResponse = await response.json();
      
      if (data.success) {
        setStats(data.data);
        setRecentProjects(data.data.recentActivity || []);
      } else {
        throw new Error(data.error || 'Failed to load dashboard data');
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
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleProjectCreated = () => {
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
          <Link href="/admin/site-schedule">
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Site Schedule
            </Button>
          </Link>
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
          title="Site Activities"
          value={stats.tasks.total}
          description={`${stats.tasks.completionRate}% completed`}
          icon={<ClipboardList className="h-6 w-6" />}
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
          title="Delayed Activities"
          value={stats.tasks.overdue}
          description="Need attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={{ value: stats.performance.overdueTasksTrend, isPositive: stats.performance.overdueTasksTrend <= 0 }}
        />
      </div>

      {/* Quick Access Card for Site Schedule */}
      <Card variant="elegant" className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-primary-900 mb-2">
                View Complete Site Schedule
              </h3>
              <p className="text-primary-700 text-sm mb-4">
                Access detailed project schedules, daily progress tracking, and contractor assignments all in one place.
              </p>
              <div className="flex gap-3">
                <Link href="/admin/site-schedule">
                  <Button className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4" />
                    View Full Schedule
                  </Button>
                </Link>
                <Link href="/admin/site-schedule/daily">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Today&apos;s Activities
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <ClipboardList className="h-24 w-24 text-primary-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card variant="elegant">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary-600" />
                Recent Projects
              </CardTitle>
              <Link href="/admin/projects">
                <Button variant="ghost" size="sm" className="text-primary-600">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentProjects.length > 0 ? (
                recentProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{project.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <StatusBadge status={project.status} />
                        <span className="text-sm text-neutral-600">
                          {project.progress}% complete
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-600">
                        {formatTimeAgo(new Date(project.timestamp))}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500">No recent projects</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCreateProject(true)}
                  >
                    Create First Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-neutral-600">On-Time Completion</span>
                  <span className="text-sm font-medium">
                    {stats.performance.onTimePercentage}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.performance.onTimePercentage}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-neutral-600">Average Project Progress</span>
                  <span className="text-sm font-medium">
                    {stats.projects.averageProgress}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.projects.averageProgress}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Avg. Completion Time</span>
                  <span className="text-sm font-medium">
                    {stats.performance.averageCompletionTime} days
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Today&apos;s Site Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-primary-600">12</p>
                  <p className="text-sm text-neutral-600 mt-1">Activities Scheduled</p>
                </div>
                <Link href="/admin/site-schedule/daily">
                  <Button className="w-full" variant="outline">
                    View Today&apos;s Schedule
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showCreateProject && (
        <CreateProjectModal
          open={showCreateProject}
          onClose={() => setShowCreateProject(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </div>
  );
}