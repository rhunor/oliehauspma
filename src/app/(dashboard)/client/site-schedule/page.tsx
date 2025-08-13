// src/app/(dashboard)/client/site-schedule/page.tsx - CLIENT SITE SCHEDULE
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Download,
  MessageSquare,
  User,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SiteActivity {
  _id: string;
  title: string;
  contractor: string;
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  comments?: string;
  supervisor?: string;
  projectId: string;
  projectTitle: string;
  phase?: string;
  week?: number;
  day?: number;
  images?: string[];
}

interface ClientProject {
  _id: string;
  title: string;
  status: string;
  progress: number;
  manager: {
    name: string;
    email: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />;
    case 'delayed': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default: return <Calendar className="h-4 w-4 text-yellow-600" />;
  }
};

export default function ClientSiteSchedulePage() {
  const { data: _session } = useSession(); // Prefixed with underscore to indicate intentionally unused
  const { toast } = useToast();
  const [activities, setActivities] = useState<SiteActivity[]>([]);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch client's projects
      const projectsResponse = await fetch('/api/projects?client=true');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.data.data || []);
      }

      // Fetch site schedule activities for client's projects
      const activitiesResponse = await fetch('/api/site-schedule/activities?client=true');
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.data || []);
      }

    } catch (error) {
      console.error('Error fetching site schedule data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load site schedule data",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter activities based on selected filters
  const filteredActivities = activities.filter(activity => {
    const projectMatch = selectedProject === 'all' || activity.projectId === selectedProject;
    const statusMatch = selectedStatus === 'all' || activity.status === selectedStatus;
    return projectMatch && statusMatch;
  });

  // Calculate statistics
  const stats = {
    total: filteredActivities.length,
    completed: filteredActivities.filter(a => a.status === 'completed').length,
    inProgress: filteredActivities.filter(a => a.status === 'in_progress').length,
    upcoming: filteredActivities.filter(a => a.status === 'pending' && new Date(a.plannedDate) > new Date()).length,
    delayed: filteredActivities.filter(a => a.status === 'delayed').length,
  };

  const overallProgress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Schedule</h1>
          <p className="text-gray-600 mt-1">Track the progress of your project activities</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/messages">
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Ask Questions
            </Button>
          </Link>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Schedule
          </Button>
        </div>
      </div>

      {/* Project Overview */}
      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project._id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{project.title}</h3>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <User className="h-3 w-3" />
                      <span>Manager: {project.manager.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filter by Project
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filter by Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Upcoming</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Overall Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4 text-sm text-green-600 font-medium">
              ✓ Finished
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4 text-sm text-blue-600 font-medium">
              🔄 Active now
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-3xl font-bold text-gray-900">{stats.upcoming}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-4 text-sm text-yellow-600 font-medium">
              📅 Scheduled
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delayed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.delayed}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${stats.delayed > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div className="mt-4 text-sm">
              {stats.delayed > 0 ? (
                <span className="text-red-600 font-medium">⚠️ Needs attention</span>
              ) : (
                <span className="text-green-600 font-medium">✅ On track</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
              <p className="text-gray-600 mb-4">
                {selectedProject !== 'all' || selectedStatus !== 'all' 
                  ? 'No activities match your current filters.'
                  : 'No site activities have been scheduled yet.'
                }
              </p>
              <div className="flex justify-center gap-3">
                {(selectedProject !== 'all' || selectedStatus !== 'all') && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedProject('all');
                      setSelectedStatus('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
                <Link href="/client/messages">
                  <Button>Contact Your Manager</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div 
                  key={activity._id} 
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(activity.status)}
                        <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Project:</span>
                          <p>{activity.projectTitle}</p>
                        </div>
                        <div>
                          <span className="font-medium">Contractor:</span>
                          <p>{activity.contractor}</p>
                        </div>
                        <div>
                          <span className="font-medium">Planned Date:</span>
                          <p>{formatDate(new Date(activity.plannedDate))}</p>
                        </div>
                        <div>
                          <span className="font-medium">Supervisor:</span>
                          <p>{activity.supervisor || 'Not assigned'}</p>
                        </div>
                      </div>

                      {activity.actualDate && (
                        <div className="mb-2 text-sm">
                          <span className="font-medium text-gray-600">Completed on:</span>
                          <span className="ml-2 text-green-600">{formatDate(new Date(activity.actualDate))}</span>
                        </div>
                      )}

                      {activity.comments && (
                        <div className="mb-3">
                          <span className="font-medium text-gray-600 text-sm">Notes:</span>
                          <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">{activity.comments}</p>
                        </div>
                      )}

                      {activity.phase && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Phase: {activity.phase}</span>
                          {activity.week && <span>Week {activity.week}</span>}
                          {activity.day && <span>Day {activity.day}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {activity.images && activity.images.length > 0 && (
                        <Button variant="outline" size="sm" title="View Photos">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Link href={`/client/messages?topic=${encodeURIComponent(activity.title)}`}>
                        <Button variant="outline" size="sm" title="Ask about this activity">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Questions About Your Schedule?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800 mb-3">
              Have questions about any activity or timeline? Your project manager is here to help!
            </p>
            <div className="flex gap-3">
              <Link href="/client/messages">
                <Button size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </Link>
              <Link href="/client/support">
                <Button size="sm" variant="outline">
                  AI Assistant
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}