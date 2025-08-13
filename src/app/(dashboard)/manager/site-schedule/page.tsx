// src/app/(dashboard)/manager/site-schedule/page.tsx - MANAGER SITE SCHEDULE
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Eye,
  Edit,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
}

interface ManagerProject {
  _id: string;
  title: string;
  status: string;
  client: {
    name: string;
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

export default function ManagerSiteSchedulePage() {
  const { data: _session } = useSession();
  const { toast } = useToast();
  const [activities, setActivities] = useState<SiteActivity[]>([]);
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch manager's projects
      const projectsResponse = await fetch('/api/projects?manager=true');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.data.data || []);
      }

      // Fetch site schedule activities for manager's projects
      const activitiesResponse = await fetch('/api/site-schedule/activities?manager=true');
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
  }, [toast]); // ✅ Added toast dependency

  useEffect(() => {
    fetchData();
  }, [fetchData]); // ✅ Now includes fetchData dependency

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
    delayed: filteredActivities.filter(a => a.status === 'delayed').length,
  };

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
          <p className="text-gray-600 mt-1">Manage activities and track progress for your projects</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily View
            </Button>
          </Link>
          <Button className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Schedule
          </Button>
        </div>
      </div>

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
                  <SelectItem value="pending">Pending</SelectItem>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delayed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.delayed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle>Site Activities</CardTitle>
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
                <Link href="/manager/site-schedule/daily">
                  <Button>Add Activities</Button>
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
                        <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
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
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-gray-600">Actual Date:</span>
                          <span className="ml-2">{formatDate(new Date(activity.actualDate))}</span>
                        </div>
                      )}

                      {activity.comments && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-600 text-sm">Comments:</span>
                          <p className="text-sm text-gray-700 mt-1">{activity.comments}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Link href={`/manager/projects/${activity.projectId}/schedule`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/manager/site-schedule/activity/${activity._id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
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
    </div>
  );
}