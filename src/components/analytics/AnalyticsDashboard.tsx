// src/components/analytics/AnalyticsDashboard.tsx - Complete Analytics Dashboard
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer
} from 'recharts';
import {
  Users,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare,
  Download,
  Filter
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface DashboardAnalytics {
  overview: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    totalUsers: number;
    activeUsers: number;
    totalFiles: number;
    unreadMessages: number;
  };
  charts: {
    projectsByStatus: Array<{ name: string; value: number; color: string }>;
    tasksByPriority: Array<{ name: string; value: number; color: string }>;
    projectProgress: Array<{ name: string; progress: number; budget: number }>;
    monthlyActivity: Array<{ month: string; projects: number; tasks: number; files: number }>;
    userActivity: Array<{ name: string; role: string; lastActive: string; projectsCount: number }>;
    budgetAnalysis: Array<{ category: string; allocated: number; spent: number }>;
  };
  trends: {
    projectCompletionRate: number;
    taskCompletionRate: number;
    averageProjectDuration: number;
    onTimeDeliveryRate: number;
    clientSatisfactionScore: number;
    teamProductivity: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    count: number;
    actionUrl?: string;
  }>;
}

export default function AnalyticsDashboard() {
  const { data: session } = useSession();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/dashboard?period=${period}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
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

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics data</p>
        <Button onClick={loadAnalytics} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Overview Cards Component
  const OverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalProjects}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.overview.activeProjects} active
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalTasks}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.overview.completedTasks} completed
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.activeUsers}</p>
              <p className="text-xs text-gray-500 mt-1">
                of {analytics.overview.totalUsers} total
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Files Uploaded</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalFiles}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.overview.unreadMessages} unread messages
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Trends Component
  const TrendsSection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Project Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{analytics.trends.projectCompletionRate}%</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <Progress value={analytics.trends.projectCompletionRate} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{analytics.trends.taskCompletionRate}%</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <Progress value={analytics.trends.taskCompletionRate} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{analytics.trends.onTimeDeliveryRate}%</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <Progress value={analytics.trends.onTimeDeliveryRate} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );

  // Charts Section
  const ChartsSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Projects by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.charts.projectsByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.charts.projectsByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tasks by Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.charts.tasksByPriority}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8">
                {analytics.charts.tasksByPriority.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Activity */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Monthly Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.charts.monthlyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="projects" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="tasks" stroke="#82ca9d" strokeWidth={2} />
              <Line type="monotone" dataKey="files" stroke="#ffc658" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  // Project Progress Chart
  const ProjectProgressChart = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Project Progress Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analytics.charts.projectProgress.slice(0, 8).map((project, index) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Progress value={project.progress} className="flex-1 h-2" />
                  <span className="text-sm text-gray-500">{project.progress}%</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrency(project.budget)}</p>
                <p className="text-xs text-gray-500">Budget</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Budget Analysis Chart
  const BudgetAnalysisChart = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Budget Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.charts.budgetAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="allocated" fill="#8884d8" name="Allocated" />
            <Bar dataKey="spent" fill="#82ca9d" name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  // User Activity Table
  const UserActivityTable = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>User Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analytics.charts.userActivity.map((user, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{user.projectsCount} projects</p>
                <p className="text-xs text-gray-500">
                  {formatDate(user.lastActive)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Alerts Section
  const AlertsSection = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>System Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {analytics.alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No alerts at this time</p>
          ) : (
            analytics.alerts.map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    alert.type === 'error' ? 'bg-red-100' :
                    alert.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                  }`}>
                    {alert.type === 'error' ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : alert.type === 'warning' ? (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-gray-500">{alert.message}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={alert.type === 'error' ? 'destructive' : 'secondary'}>
                    {alert.count}
                  </Badge>
                  {alert.actionUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={alert.actionUrl}>View</a>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your project management</p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <OverviewCards />

      {/* Trends */}
      <TrendsSection />

      {/* Alerts */}
      {analytics.alerts.length > 0 && <AlertsSection />}

      {/* Tabs for Different Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <ChartsSection />
        </TabsContent>
        
        <TabsContent value="projects" className="mt-6">
          <ProjectProgressChart />
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <UserActivityTable />
        </TabsContent>
        
        <TabsContent value="budget" className="mt-6">
          <BudgetAnalysisChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}