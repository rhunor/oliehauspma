//src/app/(dashboard)/manager/site-schedule/daily/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  CalendarCheck, 
  Clock, 
  User,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Save,
  X
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

// TypeScript interfaces
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

// Utility functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'delayed': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'delayed': return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

export default function ManagerDailyActivitiesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  // State management
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Form state for new activity
  const [newActivity, setNewActivity] = useState<Partial<DailyActivity>>({
    title: '',
    description: '',
    contractor: '',
    plannedDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    priority: 'medium',
    category: 'other',
    estimatedDuration: 4
  });

  // Fetch data functions
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

  const fetchDailyProgress = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProject && selectedProject !== 'all') params.append('project', selectedProject);
      if (selectedDate) params.append('date', selectedDate);
      
      const response = await fetch(`/api/site-schedule/daily?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching daily progress:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load daily progress",
      });
    }
  }, [selectedProject, selectedDate, toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProjects(), fetchDailyProgress()]);
    setLoading(false);
  }, [fetchProjects, fetchDailyProgress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Form handlers
  const handleAddActivity = async () => {
    if (!selectedProject || selectedProject === 'all' || selectedProject === 'none' || !newActivity.title || !newActivity.contractor) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const activityData = {
        ...newActivity,
        project: selectedProject,
        createdBy: session?.user?.id
      };

      const response = await fetch('/api/site-schedule/daily/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Daily activity added successfully",
        });
        
        // Reset form and close dialog
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          plannedDate: new Date().toISOString().split('T')[0],
          status: 'pending',
          priority: 'medium',
          category: 'other',
          estimatedDuration: 4
        });
        setSelectedProject('all');
        setIsAddDialogOpen(false);
        
        // Refresh data
        await fetchDailyProgress();
      } else {
        throw new Error('Failed to add activity');
      }
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add activity",
      });
    }
  };

  const calculateStats = () => {
    const allActivities = dailyProgress.flatMap(dp => dp.activities);
    return {
      total: allActivities.length,
      completed: allActivities.filter(a => a.status === 'completed').length,
      inProgress: allActivities.filter(a => a.status === 'in_progress').length,
      pending: allActivities.filter(a => a.status === 'pending').length,
      delayed: allActivities.filter(a => a.status === 'delayed').length,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 sm:h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* FIXED: Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/manager/site-schedule" className="self-start">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Schedule</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Daily Activities</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Track and manage daily site activities and progress
            </p>
          </div>
        </div>
        
        {/* FIXED: Responsive Add Activity Button */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Daily Activity</DialogTitle>
              <DialogDescription>
                Create a new activity to track daily site progress
              </DialogDescription>
            </DialogHeader>
            
            {/* FIXED: Responsive Form Layout */}
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Project *</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
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
                
                <div className="space-y-2">
                  <Label htmlFor="plannedDate">Planned Date</Label>
                  <Input
                    id="plannedDate"
                    type="date"
                    value={newActivity.plannedDate}
                    onChange={(e) => setNewActivity({...newActivity, plannedDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Activity Title *</Label>
                <Input
                  id="title"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                  placeholder="e.g., Foundation concrete pouring"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                  placeholder="Detailed description of the activity..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractor">Contractor *</Label>
                  <Input
                    id="contractor"
                    value={newActivity.contractor}
                    onChange={(e) => setNewActivity({...newActivity, contractor: e.target.value})}
                    placeholder="Contractor name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supervisor">Supervisor</Label>
                  <Input
                    id="supervisor"
                    value={newActivity.supervisor || ''}
                    onChange={(e) => setNewActivity({...newActivity, supervisor: e.target.value})}
                    placeholder="Site supervisor"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={newActivity.status || 'pending'} onValueChange={(value: 'pending' | 'in_progress' | 'completed' | 'delayed') => setNewActivity({...newActivity, status: value})}>
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
                
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newActivity.priority || 'medium'} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setNewActivity({...newActivity, priority: value})}>
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
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={newActivity.category || 'other'} onValueChange={(value: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other') => setNewActivity({...newActivity, category: value})}>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Estimated Duration (hours)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newActivity.estimatedDuration}
                  onChange={(e) => setNewActivity({...newActivity, estimatedDuration: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAddActivity} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* FIXED: Responsive Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <Label htmlFor="project-filter" className="text-sm">Filter by Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 sm:flex-none sm:w-48">
              <Label htmlFor="date-filter" className="text-sm">Filter by Date</Label>
              <Input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FIXED: Responsive Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Total</p>
            <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Pending</p>
            <p className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">Delayed</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600">{stats.delayed}</p>
          </CardContent>
        </Card>
      </div>

      {/* FIXED: Responsive Activities List */}
      {dailyProgress.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Activity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dailyProgress.map((progress) => (
            <Card key={progress._id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-blue-600" />
                    {formatDate(new Date(progress.date))}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {progress.activities.length} activities
                    </Badge>
                    {projects.find(p => p._id === progress.project) && (
                      <Badge variant="secondary" className="text-xs">
                        {projects.find(p => p._id === progress.project)?.title}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* FIXED: Responsive Activities Grid */}
                <div className="space-y-3">
                  {progress.activities.map((activity) => (
                    <div key={activity._id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                        {/* Activity Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 line-clamp-1">{activity.title}</h4>
                              {activity.description && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{activity.description}</p>
                              )}
                            </div>
                            
                            {/* Status and Priority Badges */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusIcon(activity.status)}
                              <Badge className={`text-xs border ${getStatusColor(activity.status)}`}>
                                {activity.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={`text-xs border ${getPriorityColor(activity.priority)}`}>
                                {activity.priority}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* FIXED: Responsive Activity Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm text-gray-600">
                            <div className="truncate">
                              <span className="font-medium">Contractor:</span>
                              <p className="truncate">{activity.contractor}</p>
                            </div>
                            <div>
                              <span className="font-medium">Planned:</span>
                              <p>{formatDate(new Date(activity.plannedDate))}</p>
                            </div>
                            {activity.supervisor && (
                              <div className="truncate">
                                <span className="font-medium">Supervisor:</span>
                                <p className="truncate">{activity.supervisor}</p>
                              </div>
                            )}
                            {activity.estimatedDuration && (
                              <div>
                                <span className="font-medium">Duration:</span>
                                <p>{activity.estimatedDuration}h estimated</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Additional Details */}
                          {activity.actualDate && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium text-gray-600">Actual Date:</span>
                              <span className="ml-2">{formatDate(new Date(activity.actualDate))}</span>
                            </div>
                          )}
                          
                          {activity.comments && (
                            <div className="mt-2">
                              <span className="font-medium text-gray-600 text-sm">Comments:</span>
                              <p className="text-sm text-gray-700 mt-1 line-clamp-2">{activity.comments}</p>
                            </div>
                          )}
                          
                          {activity.category && activity.category !== 'other' && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {activity.category}
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        {/* FIXED: Responsive Action Buttons */}
                        <div className="flex lg:flex-col items-center gap-2 flex-shrink-0">
                          <Link href={`/manager/site-schedule/activity/${activity._id}/edit`} className="flex-1 lg:flex-none">
                            <Button variant="outline" size="sm" className="w-full lg:w-auto">
                              <Edit className="h-4 w-4 lg:mr-0 sm:mr-2" />
                              <span className="lg:hidden">Edit</span>
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" className="flex-1 lg:flex-none text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4 lg:mr-0 sm:mr-2" />
                            <span className="lg:hidden">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Progress Summary */}
                {progress.summary && (
                  <div className="mt-4 pt-4 border-t bg-gray-50 -mx-4 px-4 py-3 rounded-b-lg">
                    <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Daily Summary
                    </h5>
                    
                    {/* FIXED: Responsive Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                      <div className="text-center">
                        <p className="text-gray-600">Total</p>
                        <p className="font-semibold">{progress.summary.totalActivities}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Completed</p>
                        <p className="font-semibold text-green-600">{progress.summary.completed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">In Progress</p>
                        <p className="font-semibold text-blue-600">{progress.summary.inProgress}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Pending</p>
                        <p className="font-semibold text-yellow-600">{progress.summary.pending}</p>
                      </div>
                      {progress.summary.totalHours && (
                        <div className="text-center">
                          <p className="text-gray-600">Hours</p>
                          <p className="font-semibold">{progress.summary.totalHours}h</p>
                        </div>
                      )}
                      {progress.summary.crewSize && (
                        <div className="text-center">
                          <p className="text-gray-600">Crew Size</p>
                          <p className="font-semibold">{progress.summary.crewSize}</p>
                        </div>
                      )}
                    </div>
                    
                    {progress.summary.weatherConditions && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-gray-600">Weather:</span>
                        <span className="ml-2">{progress.summary.weatherConditions}</span>
                      </div>
                    )}
                    
                    {progress.notes && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600 text-sm">Notes:</span>
                        <p className="text-sm text-gray-700 mt-1">{progress.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* FIXED: Responsive Footer Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
        <p className="text-sm text-gray-600 text-center sm:text-left">
          {dailyProgress.length > 0 ? (
            <>Showing {dailyProgress.length} day{dailyProgress.length !== 1 ? 's' : ''} of progress</>
          ) : (
            'No activities found for the selected criteria'
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link href="/manager/site-schedule" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Schedule
            </Button>
          </Link>
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Add Activity
          </Button>
        </div>
      </div>
    </div>
  );
}