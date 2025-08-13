// src/app/(dashboard)/manager/analytics/page.tsx - MANAGER ANALYTICS
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  BarChart, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  projectMetrics: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    averageProgress: number;
    projectsThisMonth: number;
    projectCompletionRate: number;
  };
  taskMetrics: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    averageCompletionTime: number;
    taskCompletionRate: number;
  };
  clientMetrics: {
    totalClients: number;
    activeClients: number;
    clientSatisfactionScore: number;
    averageResponseTime: number;
  };
  timelineMetrics: {
    onTimeProjects: number;
    delayedProjects: number;
    averageProjectDuration: number;
    upcomingDeadlines: number;
  };
  monthlyData: Array<{
    month: string;
    projectsCompleted: number;
    tasksCompleted: number;
    clientMessages: number;
  }>;
  projectBreakdown: Array<{
    projectName: string;
    progress: number;
    status: string;
    daysRemaining: number;
  }>;
}

export default function ManagerAnalyticsPage() {
  const { data: _session } = useSession(); // Prefixed with underscore to indicate intentionally unused
  const { toast } = useToast();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/manager/detailed?timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      if (data.success) {
        setAnalyticsData(data.data);
      } else {
        throw new Error(data.error || 'Failed to load analytics');
      }
      
    } catch (error: unknown) {
      console.error('Analytics fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportReport = async () => {
    try {
      toast({
        title: "Exporting Report",
        description: "Your analytics report is being generated...",
      });
      
      const response = await fetch(`/api/analytics/manager/export?timeRange=${timeRange}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manager-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Report Exported",
          description: "Your analytics report has been downloaded",
        });
      } else {
        throw new Error('Failed to export report');
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export analytics report",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Unavailable</h3>
              <p className="text-gray-600 mb-4">{error || 'Unable to load analytics data'}</p>
              <Button onClick={fetchAnalytics}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your project performance and team metrics</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Project Metrics */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Project Completion</p>
                <p className="text-3xl font-bold text-gray-900">
                  {analyticsData.projectMetrics.projectCompletionRate}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4">
              <Progress value={analyticsData.projectMetrics.projectCompletionRate} className="h-2" />
              <p className="text-xs text-gray-500 mt-2">
                {analyticsData.projectMetrics.completedProjects} of {analyticsData.projectMetrics.totalProjects} projects
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Task Efficiency</p>
                <p className="text-3xl font-bold text-gray-900">
                  {analyticsData.taskMetrics.taskCompletionRate}%
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">
                {analyticsData.taskMetrics.completedTasks} completed
              </span>
              {analyticsData.taskMetrics.overdueTasks > 0 && (
                <span className="text-red-600 ml-2">
                  • {analyticsData.taskMetrics.overdueTasks} overdue
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Client Satisfaction</p>
                <p className="text-3xl font-bold text-gray-900">
                  {analyticsData.clientMetrics.clientSatisfactionScore}/10
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">
                {analyticsData.clientMetrics.activeClients} active clients
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On-Time Delivery</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round((analyticsData.timelineMetrics.onTimeProjects / 
                    (analyticsData.timelineMetrics.onTimeProjects + analyticsData.timelineMetrics.delayedProjects) 
                    || 0) * 100)}%
                </p>
              </div>
              <Calendar className={`h-8 w-8 ${
                analyticsData.timelineMetrics.delayedProjects > 0 ? 'text-red-600' : 'text-green-600'
              }`} />
            </div>
            <div className="mt-4 flex items-center text-sm">
              {analyticsData.timelineMetrics.delayedProjects > 0 ? (
                <span className="text-red-600 font-medium">
                  {analyticsData.timelineMetrics.delayedProjects} delayed
                </span>
              ) : (
                <span className="text-green-600 font-medium">All on track</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.monthlyData.slice(-6).map((month) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{month.month}</span>
                    <span className="text-gray-600">
                      {month.projectsCompleted} projects, {month.tasksCompleted} tasks
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Projects</span>
                        <span>{month.projectsCompleted}</span>
                      </div>
                      <Progress value={(month.projectsCompleted / 10) * 100} className="h-1" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Tasks</span>
                        <span>{month.tasksCompleted}</span>
                      </div>
                      <Progress value={(month.tasksCompleted / 50) * 100} className="h-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Projects Status */}
        <Card>
          <CardHeader>
            <CardTitle>Current Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.projectBreakdown.slice(0, 6).map((project) => (
                <div key={project.projectName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm truncate">{project.projectName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          project.status === 'completed' ? 'bg-green-100 text-green-800' :
                          project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          project.status === 'delayed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {project.status.replace('_', ' ')}
                        </span>
                        {project.daysRemaining > 0 && (
                          <span className="text-xs text-gray-500">
                            {project.daysRemaining} days left
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-sm font-bold">{project.progress}%</span>
                    </div>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-600">Strengths</h4>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• High project completion rate</li>
                <li>• Good client satisfaction scores</li>
                <li>• Efficient task management</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-600">Areas for Improvement</h4>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Reduce task overdue rate</li>
                <li>• Improve timeline estimation</li>
                <li>• Faster client response times</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-600">Action Items</h4>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Review overdue tasks weekly</li>
                <li>• Set up deadline reminders</li>
                <li>• Schedule regular client check-ins</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}