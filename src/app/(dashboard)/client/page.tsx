// src/app/(dashboard)/client/page.tsx - FIXED DATA STRUCTURE ERROR
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  FolderOpen, 
  MessageSquare,
  FileText,
  Download,
  Eye,
  Clock,
  User,
  Phone,
  Mail,
  Bot,
  Calendar,
  AlertTriangle,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatTimeAgo, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  manager: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  startDate?: string;
  endDate?: string;
  budget?: number;
  updatedAt: string;
  createdAt: string;
  siteSchedule?: {
    totalActivities: number;
    completedActivities: number;
    lastUpdated?: string;
  };
}

interface ProjectFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  uploadedBy: {
    name: string;
  };
  createdAt: string;
}

interface ProjectUpdate {
  _id: string;
  title: string;
  message: string;
  type: 'milestone' | 'progress' | 'delay' | 'completion';
  createdAt: string;
  images?: string[];
}

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
  };
  isRead: boolean;
  createdAt: string;
}

interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProgress: number;
  unreadMessages: number;
  recentFiles: number;
}

// Fix: Define proper API response structure
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Fix: Define proper data wrapper structure
interface DataWrapper<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
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

export default function ClientDashboard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentFiles, setRecentFiles] = useState<ProjectFile[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<ProjectUpdate[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch client-specific data with proper error handling
      const responses = await Promise.allSettled([
        fetch('/api/analytics/client/dashboard'),
        fetch('/api/projects?limit=3'),
        fetch('/api/files?limit=5&recent=true'),
        fetch('/api/project-updates?limit=5'),
        fetch('/api/messages?limit=5&unreadFirst=true')
      ]);

      // Handle stats response
      if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
        const statsData: ApiResponse<ClientStats> = await responses[0].value.json();
        if (statsData.success && statsData.data) {
          setStats(statsData.data);
        }
      }

      // Handle projects response
      if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
        const projectsData: ApiResponse<DataWrapper<Project>> = await responses[1].value.json();
        if (projectsData.success && projectsData.data) {
          // Fix: Handle both direct array and wrapped data structure
          const projectArray = Array.isArray(projectsData.data) 
            ? projectsData.data 
            : projectsData.data.data || [];
          setProjects(projectArray);
        }
      }

      // Handle files response (optional)
      if (responses[2].status === 'fulfilled' && responses[2].value.ok) {
        try {
          const filesData: ApiResponse<DataWrapper<ProjectFile>> = await responses[2].value.json();
          if (filesData.success && filesData.data) {
            // Fix: Handle nested data structure safely
            const filesArray = Array.isArray(filesData.data)
              ? filesData.data
              : filesData.data.data || [];
            setRecentFiles(filesArray);
          }
        } catch (error) {
          console.warn('Failed to parse files data:', error);
          // Continue without files data
        }
      }

      // Handle updates response (optional)
      if (responses[3].status === 'fulfilled' && responses[3].value.ok) {
        try {
          const updatesData: ApiResponse<ProjectUpdate[]> = await responses[3].value.json();
          if (updatesData.success && updatesData.data) {
            setRecentUpdates(Array.isArray(updatesData.data) ? updatesData.data : []);
          }
        } catch (error) {
          console.warn('Failed to parse updates data:', error);
          // Continue without updates data
        }
      }

      // Handle messages response (optional)
      if (responses[4].status === 'fulfilled' && responses[4].value.ok) {
        try {
          const messagesData: ApiResponse<DataWrapper<Message>> = await responses[4].value.json();
          if (messagesData.success && messagesData.data) {
            // Fix: Handle nested data structure safely
            const messagesArray = Array.isArray(messagesData.data)
              ? messagesData.data
              : messagesData.data.data || [];
            setRecentMessages(messagesArray);
          }
        } catch (error) {
          console.warn('Failed to parse messages data:', error);
          // Continue without messages data
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
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

  const activeProject = projects.find(p => p.status === 'in_progress') || projects[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'Client'}!
          </h1>
          <p className="text-neutral-600 mt-1">
            Track your project progress and stay connected with your design team.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/messages">
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message Team
            </Button>
          </Link>
          <Link href="/client/support">
            <Button className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Assistant
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Your Projects</p>
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
                  <p className="text-sm font-medium text-gray-600">Average Progress</p>
                  <p className="text-3xl font-bold text-gray-900">{Math.round(stats.averageProgress)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-4">
                <Progress value={stats.averageProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">New Messages</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.unreadMessages}</p>
                </div>
                <MessageSquare className={`h-8 w-8 ${stats.unreadMessages > 0 ? 'text-purple-600' : 'text-gray-400'}`} />
              </div>
              <div className="mt-4 flex items-center text-sm">
                {stats.unreadMessages > 0 ? (
                  <span className="text-purple-600 font-medium">Awaiting your response</span>
                ) : (
                  <span className="text-green-600 font-medium">All caught up</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Project */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">Current Project</CardTitle>
              <Link href="/client/projects">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!activeProject ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Projects</h3>
                  <p className="text-gray-600">You don&apos;t have any active projects at the moment.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Project Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{activeProject.title}</h3>
                        <Badge className={getStatusColor(activeProject.status)}>
                          {activeProject.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(activeProject.priority)}>
                          {activeProject.priority}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-4">{activeProject.description}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-medium text-gray-900">{activeProject.progress}%</span>
                    </div>
                    <Progress value={activeProject.progress} className="h-3" />
                    {activeProject.siteSchedule && (
                      <p className="text-xs text-gray-500 mt-1">
                        {activeProject.siteSchedule.completedActivities} of {activeProject.siteSchedule.totalActivities} activities completed
                      </p>
                    )}
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Project Manager</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{activeProject.manager.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <a href={`mailto:${activeProject.manager.email}`} className="text-blue-600 hover:underline">
                            {activeProject.manager.email}
                          </a>
                        </div>
                        {activeProject.manager.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <a href={`tel:${activeProject.manager.phone}`} className="text-blue-600 hover:underline">
                              {activeProject.manager.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Timeline & Budget</h4>
                      <div className="space-y-2 text-sm">
                        {activeProject.startDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>Started {formatDate(new Date(activeProject.startDate))}</span>
                          </div>
                        )}
                        {activeProject.endDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>Due {formatDate(new Date(activeProject.endDate))}</span>
                          </div>
                        )}
                        {activeProject.budget && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">₦{formatCurrency(activeProject.budget)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Link href={`/client/projects/${activeProject._id}`}>
                      <Button size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/client/projects/${activeProject._id}/schedule`}>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        View Schedule
                      </Button>
                    </Link>
                    <Link href={`/client/messages?project=${activeProject._id}`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message Team
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Updates</CardTitle>
            </CardHeader>
            <CardContent>
              {recentUpdates.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No recent updates</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentUpdates.slice(0, 3).map((update) => (
                    <div key={update._id} className="border-l-2 border-blue-500 pl-3">
                      <h4 className="font-medium text-gray-900 text-sm">{update.title}</h4>
                      <p className="text-gray-600 text-xs mt-1">{update.message}</p>
                      <p className="text-gray-400 text-xs mt-2">
                        {formatTimeAgo(new Date(update.createdAt))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Files</CardTitle>
              <Link href="/client/files">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No files yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFiles.slice(0, 4).map((file) => (
                    <div key={file._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(new Date(file.createdAt))}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/client/messages" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                    {stats && stats.unreadMessages > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {stats.unreadMessages}
                      </Badge>
                    )}
                  </Button>
                </Link>
                <Link href="/client/files" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    View All Files
                  </Button>
                </Link>
                <Link href="/client/calendar" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Project Calendar
                  </Button>
                </Link>
                <Link href="/client/support" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Bot className="h-4 w-4 mr-2" />
                    AI Assistant
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Messages</CardTitle>
              <Link href="/client/messages">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentMessages.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMessages.slice(0, 3).map((message) => (
                    <div key={message._id} className={`p-3 rounded-lg border transition-colors ${
                      !message.isRead ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {message.sender.name}
                        </span>
                        {!message.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {message.content}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTimeAgo(new Date(message.createdAt))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}