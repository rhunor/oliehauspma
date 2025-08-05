"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  FolderOpen, 
  CheckSquare, 
  Clock,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Plus,
  Search,
  TrendingUp,
  Users,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, PriorityBadge, DeadlineBadge } from "@/components/ui/badge";
import { formatTimeAgo, calculatePercentage } from "@/lib/utils";

// Mock data - replace with actual API calls
const mockManagerStats = {
  totalProjects: 8,
  activeProjects: 6,
  completedProjects: 2,
  totalTasks: 47,
  completedTasks: 31,
  pendingTasks: 12,
  overdueTasks: 4,
  totalClients: 8,
};

const mockProjects = [
  {
    id: "1",
    title: "Luxury Villa Interior Design",
    description: "Complete interior design for a 5-bedroom luxury villa in Lekki Phase 1",
    status: "in_progress",
    progress: 75,
    priority: "high",
    client: "Mrs. Adebayo",
    manager: "John Doe",
    dueDate: "Dec 15, 2024",
    tasksCompleted: 18,
    totalTasks: 24,
    createdAt: new Date("2024-10-01"),
  },
  {
    id: "2", 
    title: "Corporate Office Renovation",
    description: "Modern office space renovation for tech startup in Victoria Island",
    status: "in_progress",
    progress: 45,
    priority: "medium",
    client: "TechCorp Ltd",
    manager: "John Doe",
    dueDate: "Jan 20, 2025",
    tasksCompleted: 9,
    totalTasks: 20,
    createdAt: new Date("2024-11-15"),
  },
  {
    id: "3",
    title: "Boutique Hotel Lobby",
    description: "Elegant lobby design for boutique hotel in Ikeja",
    status: "planning",
    progress: 20,
    priority: "urgent",
    client: "Grandeur Hotels",
    manager: "John Doe",
    dueDate: "Feb 28, 2025",
    tasksCompleted: 2,
    totalTasks: 15,
    createdAt: new Date("2024-12-01"),
  },
];

const mockTasks = [
  {
    id: "1",
    title: "Complete Living Room Design",
    description: "Finalize furniture selection and color scheme for the main living area",
    status: "in_progress",
    priority: "high",
    deadline: "Dec 10, 2024",
    assignee: "John Doe",
    projectName: "Luxury Villa Interior Design",
    client: "Mrs. Adebayo",
  },
  {
    id: "2",
    title: "Kitchen Cabinet Installation",
    description: "Coordinate with contractors for custom kitchen cabinet installation",
    status: "pending",
    priority: "medium",
    deadline: "Dec 12, 2024",
    assignee: "John Doe",
    projectName: "Luxury Villa Interior Design",
    client: "Mrs. Adebayo",
  },
  {
    id: "3",
    title: "Client Presentation Prep",
    description: "Prepare presentation materials for client review meeting",
    status: "pending",
    priority: "urgent",
    deadline: "Dec 8, 2024",
    assignee: "John Doe",
    projectName: "Corporate Office Renovation",
    client: "TechCorp Ltd",
  },
];

const mockRecentActivity = [
  {
    id: "1",
    type: "task_completed",
    message: "Completed task: Master Bedroom Design",
    project: "Luxury Villa Interior Design",
    timestamp: new Date("2024-12-01T10:30:00"),
  },
  {
    id: "2",
    type: "client_message",
    message: "New message from Mrs. Adebayo",
    project: "Luxury Villa Interior Design",
    timestamp: new Date("2024-12-01T09:15:00"),
  },
  {
    id: "3",
    type: "file_uploaded",
    message: "Uploaded floor plan sketches",
    project: "Corporate Office Renovation",
    timestamp: new Date("2024-11-30T16:45:00"),
  },
];

export default function ManagerDashboard() {
  const { data: session } = useSession();
  const stats = mockManagerStats;
  const projects = mockProjects;
  const tasks = mockTasks;
  const recentActivity = mockRecentActivity;
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || project.status === filter;
    return matchesSearch && matchesFilter;
  });

  const upcomingDeadlines = tasks
    .filter(task => {
      const deadline = new Date(task.deadline);
      const today = new Date();
      const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7 && daysUntil >= 0;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

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
            Project Manager Dashboard
          </h1>
          <p className="text-neutral-600 mt-1">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}! Manage your projects and tasks.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="My Projects"
          value={stats.totalProjects}
          description={`${stats.activeProjects} active`}
          icon={<FolderOpen className="h-6 w-6" />}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Total Tasks"
          value={stats.totalTasks}
          description={`${calculatePercentage(stats.completedTasks, stats.totalTasks)}% completed`}
          icon={<CheckSquare className="h-6 w-6" />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Clients"
          value={stats.totalClients}
          description="Active clients"
          icon={<Users className="h-6 w-6" />}
          trend={{ value: 3, isPositive: true }}
        />
        <StatsCard
          title="Overdue Tasks"
          value={stats.overdueTasks}
          description="Need attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          trend={{ value: 2, isPositive: false }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Button variant="outline" className="h-20 flex-col gap-2">
          <Plus className="h-6 w-6" />
          <span>New Task</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2">
          <MessageSquare className="h-6 w-6" />
          <span>Client Chat</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2">
          <FileText className="h-6 w-6" />
          <span>Upload Files</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2">
          <TrendingUp className="h-6 w-6" />
          <span>Reports</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card variant="elegant">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary-600" />
                My Projects
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-48"
                    inputSize="sm"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-1 border border-neutral-300 rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredProjects.map((project) => (
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
                      <span><strong>Tasks:</strong> {project.tasksCompleted}/{project.totalTasks}</span>
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

        <div className="space-y-6">
          <Card variant="elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{task.title}</p>
                      <p className="text-xs text-neutral-600">{task.projectName}</p>
                    </div>
                    <DeadlineBadge deadline={task.deadline} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No upcoming deadlines
                </p>
              )}
            </CardContent>
          </Card>

          <Card variant="elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">
                      {activity.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-500">
                        {activity.project}
                      </span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs text-neutral-500">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}