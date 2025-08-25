// src/app/(dashboard)/admin/site-schedule/daily/page.tsx - FIXED BUILD ERRORS
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card'; // FIXED: Removed unused CardHeader, CardTitle
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  CalendarCheck, 
  Clock, 
  User,
  Calendar as CalendarIcon
  // FIXED: Removed unused imports: Edit, Trash2, CheckCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

// TypeScript interfaces
interface Project {
  _id: string;
  title: string;
  client: {
    _id: string;
    name: string;
    email: string;
  };
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
}

interface DailyActivity {
  _id?: string;
  title: string;
  description: string;
  contractor: string;
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

export default function AdminDailyActivitiesPage() {
  const { toast } = useToast();
  
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

  // Form state for new activity
  const [newActivity, setNewActivity] = useState<Omit<DailyActivity, '_id'>>({
    title: '',
    description: '',
    contractor: '',
    plannedDate: selectedDate,
    status: 'pending',
    priority: 'medium',
    estimatedDuration: 60
  });

  // Fetch projects on component mount
  const fetchProjects = useCallback(async () => {
    const abortController = new AbortController(); // FIXED: Use const instead of let
    
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

      const data = await response.json();
      
      if (data.success && data.data?.data) {
        setProjects(data.data.data);
        
        // Auto-select first project if none selected
        if (data.data.data.length > 0 && !selectedProject) {
          setSelectedProject(data.data.data[0]._id);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch projects');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching projects:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load projects. Please refresh the page.',
        });
      }
    } finally {
      setProjectsLoading(false);
    }

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [selectedProject, toast]);

  // Fetch daily progress for selected project and date
  const fetchDailyProgress = useCallback(async () => {
    if (!selectedProject || !selectedDate) return;

    const abortController = new AbortController(); // FIXED: Use const instead of let
    
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
        // No progress found for this date - create empty state
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

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [selectedProject, selectedDate, toast]);

  // Add new activity
  const handleAddActivity = async () => {
    if (!selectedProject || !newActivity.title.trim() || !newActivity.contractor.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/site-schedule/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProject,
          date: selectedDate,
          activity: {
            ...newActivity,
            plannedDate: selectedDate
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
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

  // Update activity status
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

  // Date navigation
  const handleDateChange = (increment: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + increment);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  // FIXED: Effects with proper dependencies
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]); 

  useEffect(() => {
    if (selectedProject && selectedDate) {
      fetchDailyProgress();
    }
  }, [selectedProject, selectedDate, fetchDailyProgress]); // FIXED: Added missing dependencies

  // Helper functions
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Daily Site Progress
          </h1>
          <p className="text-neutral-600 mt-1">
            Track and update daily activities on site
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Link href="/admin/site-schedule">
            <Button variant="outline">
              <CalendarCheck className="h-4 w-4 mr-2" />
              Full Schedule
            </Button>
          </Link>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedProject}>
                <Plus className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Activity</DialogTitle>
                <DialogDescription>
                  Add a new activity for {selectedProject ? projects.find(p => p._id === selectedProject)?.title : 'the selected project'} on {formatDate(selectedDate)}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Activity Title *</Label>
                  <Input
                    id="title"
                    value={newActivity.title}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Foundation excavation"
                  />
                </div>
                <div>
                  <Label htmlFor="contractor">Contractor *</Label>
                  <Input
                    id="contractor"
                    value={newActivity.contractor}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, contractor: e.target.value }))}
                    placeholder="e.g., ABC Construction"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newActivity.description}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional details about the activity"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select 
                      value={newActivity.priority} 
                      onValueChange={(value: DailyActivity['priority']) => 
                        setNewActivity(prev => ({ ...prev, priority: value }))
                      }
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
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newActivity.estimatedDuration || ''}
                      onChange={(e) => setNewActivity(prev => ({ 
                        ...prev, 
                        estimatedDuration: parseInt(e.target.value) || undefined 
                      }))}
                      placeholder="60"
                    />
                  </div>
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
      </div>

      {/* Project and Date Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Label>Project:</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title} - {project.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <Label>Date:</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange(-1)}
                >
                  ←
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange(1)}
                >
                  →
                </Button>
              </div>
              {isToday && (
                <Badge variant="secondary">Today</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {dailyProgress && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {dailyProgress.summary.totalActivities}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {dailyProgress.summary.completed}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {dailyProgress.summary.inProgress}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {dailyProgress.summary.pending}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {dailyProgress.summary.delayed}
              </div>
              <div className="text-sm text-gray-600">Delayed</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activities List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      ) : dailyProgress?.activities && dailyProgress.activities.length > 0 ? (
        <div className="space-y-4">
          {dailyProgress.activities.map((activity) => (
            <Card key={activity._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{activity.title}</h3>
                      <Badge className={getStatusColor(activity.status)}>
                        {activity.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(activity.priority)}>
                        {activity.priority}
                      </Badge>
                    </div>
                    
                    {activity.description && (
                      <p className="text-gray-600 mb-3">{activity.description}</p>
                    )}
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {activity.contractor}
                      </div>
                      {activity.estimatedDuration && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {activity.estimatedDuration} min
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {new Date(activity.plannedDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Select
                      value={activity.status}
                      onValueChange={(value: DailyActivity['status']) =>
                        activity._id && handleUpdateActivityStatus(activity._id, value)
                      }
                    >
                      <SelectTrigger className="w-32">
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Scheduled</h3>
            <p className="text-gray-600 mb-4">
              {selectedProject 
                ? `No activities have been added for ${formatDate(selectedDate)}.`
                : 'Select a project to view or add daily activities.'
              }
            </p>
            {selectedProject && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Activity
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}