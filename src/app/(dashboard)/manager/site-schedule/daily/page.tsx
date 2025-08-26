// src/app/(dashboard)/manager/site-schedule/daily/page.tsx - COMPLETE MANAGER DAILY ACTIVITIES INTERFACE
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  CalendarCheck, 
  Clock, 
  User,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatDate } from '@/lib/utils';

// TypeScript interfaces - following your existing patterns
interface ManagerProject {
  _id: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  client: {
    _id: string;
    name: string;
    email: string;
  };
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
  supervisor?: string;
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
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
    totalHours?: number;
    crewSize?: number;
    weatherConditions?: string;
  };
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NewActivityForm {
  title: string;
  description: string;
  contractor: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number;
  supervisor: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
}

// Helper functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-blue-100 text-blue-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function ManagerDailyActivitiesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // State management
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null);
  
  // Form state for new activities
  const [newActivity, setNewActivity] = useState<NewActivityForm>({
    title: '',
    description: '',
    contractor: '',
    priority: 'medium',
    estimatedDuration: 60,
    supervisor: '',
    category: 'structural'
  });

  // Fetch manager's projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?manager=true');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load projects",
      });
    }
  }, [toast]);

  // Fetch daily progress for selected project and date
  const fetchDailyProgress = useCallback(async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const response = await fetch(
        `/api/site-schedule/daily?projectId=${selectedProject}&date=${dateString}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data);
      } else {
        // If no progress exists for this date, create empty structure
        setDailyProgress({
          project: selectedProject,
          date: dateString,
          activities: [],
          summary: {
            totalActivities: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            delayed: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching daily progress:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load daily activities",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedDate, toast]);

  // Add new activity
  const handleAddActivity = async (): Promise<void> => {
    if (!selectedProject || !newActivity.title.trim() || !newActivity.contractor.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const activityData = {
        ...newActivity,
        plannedDate: selectedDate.toISOString(),
        status: 'pending' as const
      };

      const response = await fetch('/api/site-schedule/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProject,
          date: selectedDate.toISOString().split('T')[0],
          activity: activityData
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity added successfully",
        });
        
        // Reset form
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          priority: 'medium',
          estimatedDuration: 60,
          supervisor: '',
          category: 'structural'
        });
        
        setIsAddDialogOpen(false);
        await fetchDailyProgress(); // Refresh data
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add activity');
      }
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add activity",
      });
    }
  };

  // Update activity status
  const handleUpdateActivityStatus = async (activityId: string, newStatus: DailyActivity['status']): Promise<void> => {
    try {
      const response = await fetch('/api/site-schedule/daily', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProject,
          date: selectedDate.toISOString().split('T')[0],
          activityId,
          updates: { 
            status: newStatus,
            actualDate: newStatus === 'completed' ? new Date().toISOString() : undefined
          }
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity status updated",
        });
        await fetchDailyProgress(); // Refresh data
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update activity');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update activity",
      });
    }
  };

  // Delete activity
  const handleDeleteActivity = async (activityId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      const response = await fetch(
        `/api/site-schedule/daily?projectId=${selectedProject}&date=${selectedDate.toISOString().split('T')[0]}&activityId=${activityId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity deleted successfully",
        });
        await fetchDailyProgress(); // Refresh data
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete activity');
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete activity",
      });
    }
  };

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Load daily progress when project or date changes
  useEffect(() => {
    if (selectedProject) {
      fetchDailyProgress();
    }
  }, [fetchDailyProgress]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/site-schedule">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Schedule
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Site Activities</h1>
            <p className="text-gray-600 mt-1">Manage daily activities and track progress</p>
          </div>
        </div>
      </div>

      {/* Project and Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Selection */}
            <div>
              <Label htmlFor="project-select">Select Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
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
              <Label htmlFor="date-select">Select Date</Label>
              <Input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Add Activity Button */}
            <div className="flex items-end">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!selectedProject} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Activity</DialogTitle>
                    <DialogDescription>
                      Add a new activity for {selectedProject ? projects.find(p => p._id === selectedProject)?.title : 'the selected project'} on {formatDate(selectedDate)}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
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
                      <Label htmlFor="supervisor">Supervisor</Label>
                      <Input
                        id="supervisor"
                        value={newActivity.supervisor}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, supervisor: e.target.value }))}
                        placeholder="e.g., John Smith"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={newActivity.priority} onValueChange={(value: NewActivityForm['priority']) => setNewActivity(prev => ({ ...prev, priority: value }))}>
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
                      <Label htmlFor="category">Category</Label>
                      <Select value={newActivity.category} onValueChange={(value: NewActivityForm['category']) => setNewActivity(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="structural">Structural</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="finishing">Finishing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                      <Input
                        id="estimatedDuration"
                        type="number"
                        value={newActivity.estimatedDuration}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) || 60 }))}
                        min="15"
                        step="15"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newActivity.description}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the activity details..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddActivity}>
                      Add Activity
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {dailyProgress && dailyProgress.activities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                        {formatDate(new Date(activity.plannedDate))}
                      </div>
                      {activity.supervisor && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          {activity.supervisor}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
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
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activity._id && handleDeleteActivity(activity._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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