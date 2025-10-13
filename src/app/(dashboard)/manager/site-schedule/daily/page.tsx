// src/app/(dashboard)/manager/site-schedule/daily/page.tsx
// CLEAN VERSION: Just image upload restoration, uses existing edit page route
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Edit,
  Trash2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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

// ==================== TYPES ====================

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
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: string[];
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress?: number;
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
  };
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== HELPER FUNCTIONS ====================

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

// ==================== MAIN COMPONENT ====================

export default function ManagerDailySchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);

  // Image lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
    comments: '',
    images: [],
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch daily progress when project or date changes
  useEffect(() => {
    if (selectedProject && selectedDate) {
      fetchDailyProgress();
    }
  }, [selectedProject, selectedDate]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/manager/projects');
      const data = await response.json();
      
      if (data.success && data.data) {
        setProjects(data.data);
        if (data.data.length > 0 && !selectedProject) {
          setSelectedProject(data.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load projects',
      });
    }
  };

  const fetchDailyProgress = useCallback(async () => {
    if (!selectedProject || !selectedDate) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/site-schedule/daily?projectId=${selectedProject}&date=${selectedDate}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data || null);
      } else {
        setDailyProgress(null);
      }
    } catch (error) {
      console.error('Error fetching daily progress:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load daily activities',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedDate, toast]);

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

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(files);

    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreview(previews);
  };

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
        description: 'Title and contractor are required',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/site-schedule/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          date: selectedDate,
          activity: newActivity,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Activity added successfully',
        });

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
          comments: '',
          images: [],
        });
        setSelectedImages([]);
        setImagePreview([]);
        
        await fetchDailyProgress();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add activity');
      }
    } catch (error) {
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

  const handleDeleteActivity = async (activityId: string) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) {
      return;
    }

    try {
      const response = await fetch(`/api/site-schedule/activity/${activityId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Activity deleted successfully',
        });
        await fetchDailyProgress();
      } else {
        throw new Error('Failed to delete activity');
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete activity',
      });
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      'completed': 'bg-green-100 text-green-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'pending': 'bg-gray-100 text-gray-800',
      'delayed': 'bg-red-100 text-red-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'to-do': 'bg-purple-100 text-purple-800',
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadgeClass = (priority: string) => {
    const classes: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-700',
      'medium': 'bg-blue-100 text-blue-700',
      'high': 'bg-orange-100 text-orange-700',
      'urgent': 'bg-red-100 text-red-700',
    };
    return classes[priority] || 'bg-gray-100 text-gray-700';
  };

  const openLightbox = (images: string[], startIndex: number = 0) => {
    setLightboxImages(images);
    setCurrentImageIndex(startIndex);
    setLightboxOpen(true);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? lightboxImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === lightboxImages.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Site Schedule</h1>
          <p className="text-gray-600 mt-1">Manage daily activities for your projects</p>
        </div>
        <Link href="/manager/site-schedule">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Schedule
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
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
              <Label>Date</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousDay}
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
                  onClick={handleNextDay}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button onClick={handleToday} variant="outline" className="flex-1">
                  <Calendar className="h-4 w-4 mr-2" />
                  Today
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {dailyProgress && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{dailyProgress.summary.totalActivities}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">To Do</p>
              <p className="text-2xl font-bold text-purple-600">{dailyProgress.summary.toDo || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-600">{dailyProgress.summary.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{dailyProgress.summary.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{dailyProgress.summary.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Delayed</p>
              <p className="text-2xl font-bold text-red-600">{dailyProgress.summary.delayed}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activities for {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading activities...</p>
            </div>
          ) : !dailyProgress || dailyProgress.activities.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No activities scheduled for this date</p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)} 
                className="mt-4"
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{activity.title}</h3>
                        <Badge className={getStatusBadgeClass(activity.status)}>
                          {activity.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityBadgeClass(activity.priority)}>
                          {activity.priority}
                        </Badge>
                      </div>

                      {activity.description && (
                        <p className="text-gray-600 text-sm mb-3">{activity.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Contractor:</span>
                          <p className="font-medium">{activity.contractor}</p>
                        </div>
                        {activity.supervisor && (
                          <div>
                            <span className="text-gray-500">Supervisor:</span>
                            <p className="font-medium">{activity.supervisor}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Start:</span>
                          <p className="font-medium">{formatDateTimeForDisplay(activity.startDate)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">End:</span>
                          <p className="font-medium">{formatDateTimeForDisplay(activity.endDate)}</p>
                        </div>
                      </div>

                      {activity.images && activity.images.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500 mb-2">Images ({activity.images.length})</p>
                          <div className="flex gap-2">
                            {activity.images.slice(0, 4).map((img, idx) => (
                              <div
                                key={idx}
                                className="relative w-16 h-16 rounded cursor-pointer hover:opacity-80"
                                onClick={() => openLightbox(activity.images!, idx)}
                              >
                                <Image
                                  src={img}
                                  alt={`Activity image ${idx + 1}`}
                                  fill
                                  className="object-cover rounded"
                                />
                              </div>
                            ))}
                            {activity.images.length > 4 && (
                              <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-sm text-gray-600">
                                +{activity.images.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Link href={`/manager/site-schedule/activity/${activity._id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteActivity(activity._id!)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Activity</DialogTitle>
            <DialogDescription>
              Create a new task for the daily schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                placeholder="Activity title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                placeholder="Activity description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={newActivity.contractor}
                  onChange={(e) => setNewActivity({ ...newActivity, contractor: e.target.value })}
                  placeholder="Contractor name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={newActivity.supervisor}
                  onChange={(e) => setNewActivity({ ...newActivity, supervisor: e.target.value })}
                  placeholder="Supervisor name"
                />
              </div>
            </div>

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

            <div className="grid grid-cols-3 gap-4">
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
                    <SelectItem value="to-do">To Do</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newActivity.category}
                  onValueChange={(value) => setNewActivity({ ...newActivity, category: value as DailyActivity['category'] })}
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

            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={newActivity.comments}
                onChange={(e) => setNewActivity({ ...newActivity, comments: e.target.value })}
                placeholder="Internal comments"
                rows={3}
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label>Upload Images</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Images
                </Button>
              </div>

              {/* Image Previews */}
              {imagePreview.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {imagePreview.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded border overflow-hidden">
                      <Image
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => {
                          const newImages = selectedImages.filter((_, i) => i !== index);
                          const newPreviews = imagePreview.filter((_, i) => i !== index);
                          setSelectedImages(newImages);
                          setImagePreview(newPreviews);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Image Lightbox */}
      {lightboxOpen && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Image {currentImageIndex + 1} of {lightboxImages.length}
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <div className="relative aspect-video">
                <Image
                  src={lightboxImages[currentImageIndex]}
                  alt={`Image ${currentImageIndex + 1}`}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevImage}
                  disabled={lightboxImages.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextImage}
                  disabled={lightboxImages.length <= 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}