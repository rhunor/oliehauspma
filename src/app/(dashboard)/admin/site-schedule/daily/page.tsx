// src/app/(dashboard)/admin/site-schedule/daily/page.tsx - ADDED: Supervisor field
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// FIXED: Proper TypeScript interfaces
interface Project {
  _id: string;
  title: string;
  status: string;
}

interface DailyActivity {
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor: string; // ADDED: Supervisor field
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration?: number;
  actualDuration?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DailyProgress {
  _id?: string;
  project: string;
  date: string;
  activities: DailyActivity[];
  summary: {
    totalActivities: number;
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
  };
  approved: boolean;
}

// Correct API response interface
interface ProjectsApiResponse {
  success: boolean;
  data?: {
    projects?: Project[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export default function AdminDailyActivitiesPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  
  // State management
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form state for new activity - ADDED supervisor field
  const [newActivity, setNewActivity] = useState<Omit<DailyActivity, '_id'>>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '', // ADDED: Supervisor field
    plannedDate: selectedDate,
    status: 'pending',
    priority: 'medium',
    estimatedDuration: 60
  });

  const fetchProjects = useCallback(async () => {
    const abortController = new AbortController();
    
    try {
      setProjectsLoading(true);
      
      const response = await fetch('/api/projects?limit=100', {
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ProjectsApiResponse = await response.json();
      
      console.log('API Response:', data);
      
      if (data.success) {
        const projectsData = data.data?.projects || [];
        
        console.log('Projects Data:', projectsData);
        
        setProjects(projectsData);
        
        if (projectsData.length > 0 && !selectedProject) {
          setSelectedProject(projectsData[0]._id);
        }
      } else {
        console.warn('No projects found or API returned error:', data.error);
        setProjects([]);
        toast({
          variant: 'default',
          title: 'No Projects',
          description: data.error || 'No projects available. Please create a project first.',
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching projects:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load projects. Please refresh the page.',
        });
        setProjects([]);
      }
    } finally {
      setProjectsLoading(false);
    }

    return () => {
      abortController.abort();
    };
  }, [toast]);

  const fetchDailyProgress = useCallback(async () => {
    if (!selectedProject || !selectedDate) return;

    const abortController = new AbortController();
    
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/site-schedule/daily?projectId=${selectedProject}&date=${selectedDate}`,
        {
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setDailyProgress(data.data);
      } else {
        setDailyProgress({
          project: selectedProject,
          date: selectedDate,
          activities: [],
          summary: {
            totalActivities: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            delayed: 0
          },
          approved: false
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching daily progress:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load daily activities.',
        });
      }
    } finally {
      setLoading(false);
    }

    return () => {
      abortController.abort();
    };
  }, [selectedProject, selectedDate, toast]);

  // UPDATED: Validation includes supervisor
  const handleAddActivity = async () => {
    if (!selectedProject || !newActivity.title.trim() || !newActivity.contractor.trim() || !newActivity.supervisor.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields (Title, Contractor, and Supervisor).',
      });
      return;
    }

    try {
      setLoading(true);

      const requestBody = {
        projectId: selectedProject,
        date: selectedDate,
        activity: {
          ...newActivity,
          plannedDate: selectedDate
        }
      };

      console.log('Request Body:', requestBody);

      const response = await fetch('/api/site-schedule/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to add activity');
      }

      const data = await response.json();
      
      if (data.success) {
        setDailyProgress(data.data);
        setIsAddDialogOpen(false);
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          supervisor: '', // ADDED: Reset supervisor
          plannedDate: selectedDate,
          status: 'pending',
          priority: 'medium',
          estimatedDuration: 60
        });
        
        toast({
          title: 'Success',
          description: 'Activity added successfully.',
        });
      }
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add activity.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateActivityStatus = async (activityId: string, newStatus: DailyActivity['status']) => {
    if (!selectedProject || !activityId) return;

    try {
      setLoading(true);

      const response = await fetch('/api/site-schedule/daily', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProject,
          date: selectedDate,
          activityId,
          updates: { status: newStatus }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update activity');
      }

      const data = await response.json();
      
      if (data.success) {
        setDailyProgress(data.data);
        toast({
          title: 'Success',
          description: 'Activity updated successfully.',
        });
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update activity.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (increment: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + increment);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject && selectedDate) {
      fetchDailyProgress();
    }
  }, [selectedProject, selectedDate, fetchDailyProgress]);

  const getStatusColor = (status: DailyActivity['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: DailyActivity['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-yellow-100 text-yellow-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (projectsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Projects Available</h3>
              <p className="text-gray-600 mb-4">
                You need to create a project before you can add daily activities.
              </p>
              <Button onClick={() => window.location.href = '/admin/projects'}>
                Go to Projects
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Daily Site Activities</h1>
          <p className="text-gray-600 mt-1">Track and manage daily construction activities</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} disabled={!selectedProject}>
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Project and Date Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div>
              <Label>Select Project</Label>
              <Select
                value={selectedProject}
                onValueChange={setSelectedProject}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div>
              <Label>Select Date</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDateChange(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDateChange(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {isToday && (
                <p className="text-sm text-blue-600 mt-1">Today&apos;s activities</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {dailyProgress && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Activities</p>
                <p className="text-3xl font-bold">{dailyProgress.summary.totalActivities}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{dailyProgress.summary.completed}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{dailyProgress.summary.inProgress}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Delayed</p>
                <p className="text-3xl font-bold text-red-600">{dailyProgress.summary.delayed}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {formatDate(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading activities...</p>
            </div>
          ) : !dailyProgress || dailyProgress.activities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No activities scheduled for this date</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Activity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyProgress.activities.map((activity) => (
                <div
                  key={activity._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{activity.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(activity.status)}>
                        {activity.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(activity.priority)}>
                        {activity.priority}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-600">Contractor</p>
                      <p className="font-medium">{activity.contractor}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Supervisor</p>
                      <p className="font-medium">{activity.supervisor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Planned Date</p>
                      <p className="font-medium">
                        {new Date(activity.plannedDate).toLocaleDateString()}
                      </p>
                    </div>
                    {activity.estimatedDuration && (
                      <div>
                        <p className="text-gray-600">Duration</p>
                        <p className="font-medium">{activity.estimatedDuration} mins</p>
                      </div>
                    )}
                  </div>

                  {activity.comments && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">{activity.comments}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Select
                      value={activity.status}
                      onValueChange={(value) => handleUpdateActivityStatus(activity._id, value as DailyActivity['status'])}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog - ADDED SUPERVISOR FIELD */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Daily Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Activity Title *</Label>
              <Input
                id="title"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                placeholder="e.g., Foundation excavation"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                placeholder="Detailed description of the activity"
                rows={3}
              />
            </div>

            {/* ADDED: Contractor and Supervisor in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={newActivity.contractor}
                  onChange={(e) => setNewActivity({ ...newActivity, contractor: e.target.value })}
                  placeholder="Contractor name"
                />
              </div>

              {/* ADDED: Supervisor field */}
              <div>
                <Label htmlFor="supervisor">Supervisor *</Label>
                <Input
                  id="supervisor"
                  value={newActivity.supervisor}
                  onChange={(e) => setNewActivity({ ...newActivity, supervisor: e.target.value })}
                  placeholder="Supervisor name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedDuration">Duration (minutes)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  value={newActivity.estimatedDuration || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, estimatedDuration: parseInt(e.target.value) || 60 })}
                  placeholder="60"
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newActivity.priority}
                  onValueChange={(value) => setNewActivity({ ...newActivity, priority: value as DailyActivity['priority'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={newActivity.status}
                onValueChange={(value) => setNewActivity({ ...newActivity, status: value as DailyActivity['status'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddActivity} disabled={loading}>
              {loading ? 'Adding...' : 'Add Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}