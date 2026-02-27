"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  CalendarCheck, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X,
  Upload,
  Image as ImageIcon
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ActivityModal from '@/components/ActivityModal'; // Updated import
import { ActivityPhase, PHASE_LABELS, PHASE_ORDER } from '@/types/activity';

// TypeScript interfaces (unchanged)
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
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: string[];
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  phase?: ActivityPhase;
  weekNumber?: number;
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
    onHold?: number;
    toDo?: number;
    crewSize?: number;
    weatherConditions?: string;
  };
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper (unchanged)
const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function ManagerDailySchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Updated: Single modal state
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Image upload state (for add)
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);


  const now = new Date();
  const [newActivity, setNewActivity] = useState<Omit<DailyActivity, '_id'>>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    startDate: formatDateTimeLocal(now),
    endDate: formatDateTimeLocal(new Date(now.getTime() + 3600000)),
    status: 'to-do',
    priority: 'medium',
    category: 'structural',
    phase: 'construction',
    weekNumber: 1,
    comments: ''
  });

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load projects',
      });
    }
  }, [toast]);

  // Fetch daily progress
  const fetchDailyProgress = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ manager: 'true' });
      if (selectedProject !== 'all') params.set('projectId', selectedProject);
      const response = await fetch(`/api/site-schedule/activities?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching daily progress:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load daily progress',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedDate, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (session) {
      fetchDailyProgress();
    }
  }, [session, fetchDailyProgress]);

  // Image handlers for add (unchanged)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedImages(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'site-activities');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        }
      }
      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to upload images',
      });
      return [];
    } finally {
      setUploadingImages(false);
    }
  };

  // Add activity (updated date to selected if available; else current)
  const handleAddActivity = async () => {
    if (selectedProject === 'all') {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a specific project',
      });
      return;
    }

    if (!newActivity.title || !newActivity.contractor) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

  try {
    const imageUrls = await uploadImages();
    const response = await fetch('/api/site-schedule/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: selectedProject,
        date: selectedDate, // Use selected/current date
        activity: { ...newActivity, images: imageUrls },
      }),
    });
    if (response.ok) {
      await fetchDailyProgress();
        setIsAddDialogOpen(false);
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          supervisor: '',
          startDate: formatDateTimeLocal(new Date()),
          endDate: formatDateTimeLocal(new Date(Date.now() + 3600000)),
          status: 'to-do',
          priority: 'medium',
          category: 'structural',
          phase: 'construction',
          weekNumber: 1,
          comments: ''
        });
        setSelectedImages([]);
        setImagePreview([]);
        toast({ title: 'Success', description: 'Activity added successfully' });
      } else {
        throw new Error('Failed to add activity');
      }
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add activity',
      });
    }
  };

  // Updated: No separate status update
const handleSuccess = useCallback(() => {
  fetchDailyProgress();
}, [fetchDailyProgress]);

  // Calculate stats (unchanged)
  const calculateStats = () => {
    const allActivities = dailyProgress.flatMap(dp => dp.activities);
    return {
      total: allActivities.length,
      completed: allActivities.filter(a => a.status === 'completed').length,
      inProgress: allActivities.filter(a => a.status === 'in_progress').length,
      pending: allActivities.filter(a => a.status === 'pending').length,
      delayed: allActivities.filter(a => a.status === 'delayed').length,
      toDo: allActivities.filter(a => a.status === 'to-do').length,
    };
  };

  const stats = calculateStats();

  // Get status badge (unchanged)
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'delayed':
        return 'bg-red-100 text-red-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'to-do':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Updated: Open modal
  const handleActivityClick = (activity: DailyActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header (unchanged) */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/manager/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Site Schedule</h1>
            <p className="text-sm text-gray-600">Manage daily construction activities</p>
          </div>
        </div>

        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Project Filter (unchanged) */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="project">Filter by Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
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
        </CardContent>
      </Card>

      {/* Statistics (unchanged) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">To-Do</p>
              <p className="text-2xl font-bold text-purple-600">{stats.toDo}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-primary-600">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Delayed</p>
              <p className="text-2xl font-bold text-red-600">{stats.delayed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities List (updated onClick) */}
      <Card>
        <CardHeader>
          <CardTitle>Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : dailyProgress.length === 0 || dailyProgress.flatMap(dp => dp.activities).length === 0 ? (
            <div className="text-center py-8">
              <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No activities found</p>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="mt-4"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Activity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyProgress.flatMap(dp => dp.activities).map((activity) => (
                <div
                  key={activity._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{activity.title}</h3>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{activity.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusBadgeClass(activity.status)}>
                        {activity.status.replace('_', ' ').replace('-', ' ')}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{activity.priority}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Contractor</p>
                      <p className="font-medium truncate">{activity.contractor}</p>
                    </div>
                    {activity.supervisor && (
                      <div>
                        <p className="text-gray-600">Supervisor</p>
                        <p className="font-medium truncate">{activity.supervisor}</p>
                      </div>
                    )}
                    {activity.category && (
                      <div>
                        <p className="text-gray-600">Category</p>
                        <p className="font-medium capitalize">{activity.category}</p>
                      </div>
                    )}
                    {activity.images && activity.images.length > 0 && (
                      <div>
                        <p className="text-gray-600">Images</p>
                        <p className="font-medium text-primary-600">{activity.images.length} attached</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between text-xs text-gray-500">
                    <span suppressHydrationWarning>
                      {new Date(activity.startDate).toLocaleString()} - {new Date(activity.endDate).toLocaleString()}
                    </span>
                    <span className="text-primary-600 font-medium">Click to view details</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog (unchanged, minor date fix if needed) */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Daily Task</DialogTitle>
            <DialogDescription>
              Create a new task for the daily site schedule
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
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

            {/* Basic Information (unchanged) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="title">Task Name *</Label>
                <Input
                  id="title"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                  placeholder="e.g., Foundation concrete pouring"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                  placeholder="Detailed description of the activity..."
                  rows={3}
                />
              </div>

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
                  placeholder="Supervisor name"
                />
              </div>
            </div>

            {/* Date and Time (unchanged) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={newActivity.startDate}
                  onChange={(e) => setNewActivity({...newActivity, startDate: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={newActivity.endDate}
                  onChange={(e) => setNewActivity({...newActivity, endDate: e.target.value})}
                />
              </div>
            </div>

            {/* Status, Priority, Category (unchanged) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newActivity.priority}
                  onValueChange={(value) => setNewActivity({...newActivity, priority: value as DailyActivity['priority']})}
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

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newActivity.status}
                  onValueChange={(value) => setNewActivity({...newActivity, status: value as DailyActivity['status']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to-do">To-Do</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newActivity.category}
                  onValueChange={(value) => setNewActivity({...newActivity, category: value as DailyActivity['category']})}
                >
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

            {/* Phase and Week Number */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phase">Phase</Label>
                <Select
                  value={newActivity.phase || 'construction'}
                  onValueChange={(value) => setNewActivity({...newActivity, phase: value as ActivityPhase})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_ORDER.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {PHASE_LABELS[phase]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekNumber">Week Number</Label>
                <Input
                  id="weekNumber"
                  type="number"
                  min={1}
                  max={20}
                  value={newActivity.weekNumber || 1}
                  onChange={(e) => setNewActivity({...newActivity, weekNumber: parseInt(e.target.value) || 1})}
                />
              </div>
            </div>

            {/* Comments (unchanged) */}
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={newActivity.comments || ''}
                onChange={(e) => setNewActivity({...newActivity, comments: e.target.value})}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            {/* Image Upload Section (unchanged) */}
            <div className="space-y-2">
              <Label>Task Images</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                
                {imagePreview.length === 0 ? (
                  <div className="text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Click to upload activity images
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Select Images
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG, GIF up to 10MB each
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {imagePreview.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add More Images
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddActivity}
              disabled={uploadingImages}
            >
              {uploadingImages ? 'Uploading Images...' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Updated: Single ActivityModal */}
      <ActivityModal
        activity={selectedActivity}
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        projectId={selectedProject === 'all' ? '' : selectedProject} // Fallback if all
        date={new Date().toISOString().split('T')[0]}
        onSuccess={handleSuccess}
        userRole="manager"
      />
    </div>
  );
}