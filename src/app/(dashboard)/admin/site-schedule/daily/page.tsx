"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  Upload,
  Image as ImageIcon,
  ArrowLeft
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
import ActivityModal from '@/components/ActivityModal'; // Updated import

// TypeScript interfaces (unchanged)
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
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: string[];
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
    toDo?: number;
  };
  approved: boolean;
}

interface ProjectsApiResponse {
  success: boolean;
  data?: {
    projects?: Project[];
    pagination?: Record<string, unknown>;
  };
  error?: string;
}

// Helpers (unchanged)
const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTimeForDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
};

export default function AdminDailySchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Updated: Single modal state
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Image upload state (for add dialog only)
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

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
    comments: '',
    images: []
  });

  // Fetch projects (unchanged)
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?limit=100');
      if (response.ok) {
        const data: ProjectsApiResponse = await response.json();
        setProjects(data.data?.projects || []);
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

  // Fetch daily progress (unchanged)
  const fetchDailyProgress = useCallback(async () => {
    if (!selectedProject || !selectedDate) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/site-schedule/daily?projectId=${selectedProject}&date=${selectedDate}`
      );

      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data);
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
    if (selectedProject && selectedDate) {
      fetchDailyProgress();
    }
  }, [selectedProject, selectedDate, fetchDailyProgress]);

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

  // Add activity (unchanged)
  const handleAddActivity = async () => {
    if (!selectedProject || !selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a project and date',
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
    setLoading(true);
    const imageUrls = await uploadImages();
    const response = await fetch('/api/site-schedule/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: selectedProject,
        date: selectedDate, // Ensure matches fetch param
        activity: {
          ...newActivity,
          images: imageUrls,
        },
      }),
    });

       if (response.ok) {
      const data = await response.json();
      setDailyProgress(data.data); // Assume full updated DailyProgress
      await fetchDailyProgress();
        setIsAddDialogOpen(false);
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          supervisor: '',
          startDate: formatDateTimeLocal(now),
          endDate: formatDateTimeLocal(new Date(now.getTime() + 3600000)),
          status: 'to-do',
          priority: 'medium',
          comments: '',
          images: []
        });
        setSelectedImages([]);
        setImagePreview([]);
          toast({ title: 'Success', description: 'Activity added successfully' });
    } else {
      throw new Error('Failed to add activity');
    }
  } catch (error)  {
      console.error('Error adding activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add activity',
      });
    } finally {
      setLoading(false);
    }
  };

  // Updated: No separate status update; handled in modal
 const handleSuccess = useCallback(() => {
  fetchDailyProgress(); // Ensure refetch with current selectedProject/date
}, [fetchDailyProgress]);

  // Updated: Open modal for view/edit
  const handleActivityClick = (activity: DailyActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

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

  // Navigate days (unchanged)
  const handlePreviousDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header (unchanged) */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
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

      {/* Project and Date Selection (unchanged) */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Select Project</Label>
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

            <div className="space-y-2">
              <Label htmlFor="date">Select Date</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousDay}
                  disabled={!selectedDate}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextDay}
                  disabled={!selectedDate}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {dailyProgress && (
              <div className="space-y-2">
                <Label>Quick Stats</Label>
                <div className="flex gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {dailyProgress.summary.completed} Completed
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {dailyProgress.summary.inProgress} In Progress
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activities List (updated onClick) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Please select a project to view activities</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : !dailyProgress || dailyProgress.activities.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No activities for this date</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Activity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyProgress.activities.map((activity) => (
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
                    <Badge className={getStatusBadgeClass(activity.status)}>
                      {activity.status.replace('_', ' ').replace('-', ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                    <div>
                      <p className="text-gray-600">Priority</p>
                      <Badge variant="outline" className="capitalize">{activity.priority}</Badge>
                    </div>
                    {activity.images && activity.images.length > 0 && (
                      <div>
                        <p className="text-gray-600">Images</p>
                        <p className="font-medium text-blue-600">{activity.images.length} attached</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
                    <span suppressHydrationWarning>
                      {formatDateTimeForDisplay(activity.startDate)} - {formatDateTimeForDisplay(activity.endDate)}
                    </span>
                    <span className="text-blue-600 font-medium">Click to view details</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog (unchanged) */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="title">Task name *</Label>
                <Input
                  id="title"
                  value={newActivity.title || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                  placeholder="e.g., Foundation concrete pouring"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newActivity.description || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  placeholder="Detailed description of the activity..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={newActivity.contractor || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, contractor: e.target.value })}
                  placeholder="Contractor name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={newActivity.supervisor || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, supervisor: e.target.value })}
                  placeholder="Supervisor name"
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={newActivity.startDate}
                  onChange={(e) => setNewActivity({ ...newActivity, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={newActivity.endDate}
                  onChange={(e) => setNewActivity({ ...newActivity, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Status and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newActivity.status}
                  onValueChange={(value) => setNewActivity({ ...newActivity, status: value as DailyActivity['status'] })}
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
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments">Internal Comments</Label>
              <Textarea
                id="comments"
                value={newActivity.comments || ''}
                onChange={(e) => setNewActivity({ ...newActivity, comments: e.target.value })}
                placeholder="Add any internal notes or comments..."
                rows={3}
              />
            </div>

            {/* Image Upload Section */}
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
                    <div className="grid grid-cols-4 gap-2 mb-3">
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
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddActivity} disabled={loading || uploadingImages}>
              {uploadingImages ? 'Uploading Images...' : loading ? 'Adding...' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Updated: Single ActivityModal */}
      <ActivityModal
        activity={selectedActivity}
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        projectId={selectedProject}
        date={selectedDate}
        onSuccess={handleSuccess}
        userRole="admin"
      />
    </div>
  );
}