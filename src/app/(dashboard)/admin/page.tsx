//src/app/(dashboard)/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
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
import { formatTimeAgo, calculatePercentage } from "@/lib/utils";

// Mock data - replace with actual API calls
const mockStats = {
  totalProjects: 24,
  activeProjects: 18,
  completedProjects: 6,
  totalTasks: 156,
  completedTasks: 89,
  pendingTasks: 45,
  overdueTasks: 12,
  totalUsers: 32,
  activeUsers: 28,
};

const mockRecentProjects = [
  {
    id: "1",
    title: "Luxury Apartment Renovation",
    description: "Complete interior renovation of a 3-bedroom luxury apartment in Lekki Phase 1",
    status: "in_progress",
    progress: 75,
    priority: "high",
    client: "Mrs. Adebayo",
    manager: "John Doe",
    dueDate: "Dec 15, 2024",
    createdAt: new Date("2024-10-01"),
  },
  {
    id: "2", 
    title: "Office Space Design",
    description: "Modern office interior design for a tech startup in Victoria Island",
    status: "planning",
    progress: 25,
    priority: "medium",
    client: "TechCorp Ltd",
    manager: "Jane Smith",
    dueDate: "Jan 20, 2025",
    createdAt: new Date("2024-11-15"),
  },
  {
    id: "3",
    title: "Restaurant Interior",
    description: "Complete restaurant interior design and decoration in Ikeja",
    status: "completed",
    progress: 100,
    priority: "urgent",
    client: "Chef's Table",
    manager: "Mike Johnson",
    dueDate: "Nov 30, 2024",
    createdAt: new Date("2024-09-20"),
  },
];

const mockRecentActivities = [
  {
    id: "1",
    type: "project_created",
    message: "New project &apos;Villa Renovation&apos; created",
    user: "Admin",
    timestamp: new Date("2024-12-01T10:30:00"),
  },
  {
    id: "2",
    type: "task_completed",
    message: "Task &apos;Kitchen Design&apos; completed by John Doe",
    user: "John Doe",
    timestamp: new Date("2024-12-01T09:15:00"),
  },
  {
    id: "3",
    type: "user_joined",
    message: "New client &apos;Sarah Wilson&apos; joined the platform",
    user: "Sarah Wilson",
    timestamp: new Date("2024-11-30T16:45:00"),
  },
  {
    id: "4",
    type: "deadline_approaching",
    message: "Project &apos;Office Design&apos; deadline approaching in 3 days",
    user: "System",
    timestamp: new Date("2024-11-30T14:20:00"),
  },
];

export default function AdminDashboard() {
  const { data: session } = useSession();
  const stats = mockStats;
  const recentProjects = mockRecentProjects;
  const recentActivities = mockRecentActivities;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Welcome back {session?.user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-neutral-600 mt-1">
            Heres whats happening with your projects today.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Projects"
          value={stats.totalProjects}
          description={`${stats.activeProjects} active`}
          icon={<FolderOpen className="h-6 w-6" />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Total Tasks"
          value={stats.totalTasks}
          description={`${calculatePercentage(stats.completedTasks, stats.totalTasks)}% completed`}
          icon={<CheckSquare className="h-6 w-6" />}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Active Users"
          value={stats.activeUsers}
          description={`${stats.totalUsers} total users`}
          icon={<Users className="h-6 w-6" />}
          trend={{ value: 5, isPositive: true }}
        />
        <StatsCard
          title="Overdue Tasks"
          value={stats.overdueTasks}
          description="Need attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={{ value: 3, isPositive: false }}
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
              {recentProjects.map((project) => (
                <div
                  key={project.id}
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
                      <span><strong>Client:</strong> {project.client}</span>
                      <span><strong>Manager:</strong> {project.manager}</span>
                      <span><strong>Due:</strong> {project.dueDate}</span>
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
              ))}
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
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">
                      {activity.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-500">
                        by {activity.user}
                      </span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs text-neutral-500">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">Add User</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <FolderOpen className="h-6 w-6" />
              <span className="text-sm">New Project</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <CheckSquare className="h-6 w-6" />
              <span className="text-sm">Assign Task</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <TrendingUp className="h-6 w-6" />
              <span className="text-sm">View Reports</span>
            </Button>
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
                  {calculatePercentage(stats.completedProjects, stats.totalProjects)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${calculatePercentage(stats.completedProjects, stats.totalProjects)}%` 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Task Completion Rate</span>
                <span className="text-green-600 font-semibold">
                  {calculatePercentage(stats.completedTasks, stats.totalTasks)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${calculatePercentage(stats.completedTasks, stats.totalTasks)}%` 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">User Activity Rate</span>
                <span className="text-blue-600 font-semibold">
                  {calculatePercentage(stats.activeUsers, stats.totalUsers)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${calculatePercentage(stats.activeUsers, stats.totalUsers)}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}