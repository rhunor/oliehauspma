// src/app/(dashboard)/manager/site-schedule/daily/page.tsx - UPDATED: Added 'to-do' status + Image Lightbox
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
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
  X,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn
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

// UPDATED: TypeScript interfaces with 'to-do' status
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

// UPDATED: Added 'to-do' to status type
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
    toDo?: number; // ADDED
    crewSize?: number;
    weatherConditions?: string;
  };
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper function to format datetime-local input
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

  // ADDED: Image lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const now = new Date();
  const [newActivity, setNewActivity] = useState<DailyActivity>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    startDate: formatDateTimeLocal(now),
    endDate: formatDateTimeLocal(new Date(now.getTime() + 3600000)), // +1 hour
    status: 'to-do', // UPDATED: Default to 'to-do'
    priority: 'medium',
    category: 'structural',
    comments: ''
  });

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects/manager');
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
      const response = await fetch('/api/site-schedule/daily/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: selectedProject === 'all' ? undefined : selectedProject 
        })
      });

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
  }, [selectedProject, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (session) {
      fetchDailyProgress();
    }
  }, [session, fetchDailyProgress]);

  // Image selection handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedImages(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove image
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  // Upload images to S3
  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', selectedProject);
        formData.append('description', 'Daily activity image');
        formData.append('isPublic', 'true');

        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.url) {
            uploadedUrls.push(result.data.url);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'Some images failed to upload',
      });
    } finally {
      setUploadingImages(false);
    }

    return uploadedUrls;
  };

  // Add activity
  const handleAddActivity = async () => {
    // Validation
    if (!selectedProject || selectedProject === 'all' || selectedProject === 'none') {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a project",
      });
      return;
    }

    if (!newActivity.title || !newActivity.contractor) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    if (!newActivity.startDate || !newActivity.endDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Start Date and End Date are required',
      });
      return;
    }

    const startDateTime = new Date(newActivity.startDate);
    const endDateTime = new Date(newActivity.endDate);

    if (endDateTime <= startDateTime) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'End Date must be after Start Date',
      });
      return;
    }

    try {
      // Upload images first
      const imageUrls = await uploadImages();

      const activityData = {
        ...newActivity,
        project: selectedProject,
        createdBy: session?.user?.id,
        images: imageUrls,
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
        
        // Reset form
        const now = new Date();
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          supervisor: '',
          startDate: formatDateTimeLocal(now),
          endDate: formatDateTimeLocal(new Date(now.getTime() + 3600000)),
          status: 'to-do', // UPDATED: Reset to 'to-do'
          priority: 'medium',
          category: 'structural',
          comments: ''
        });
        setSelectedProject('all');
        setSelectedImages([]);
        setImagePreview([]);
        setIsAddDialogOpen(false);
        
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

  // Calculate statistics - UPDATED: Include to-do
  const calculateStats = () => {
    const allActivities = dailyProgress.flatMap(dp => dp.activities);
    return {
      total: allActivities.length,
      completed: allActivities.filter(a => a.status === 'completed').length,
      inProgress: allActivities.filter(a => a.status === 'in_progress').length,
      pending: allActivities.filter(a => a.status === 'pending').length,
      delayed: allActivities.filter(a => a.status === 'delayed').length,
      toDo: allActivities.filter(a => a.status === 'to-do').length, // ADDED
    };
  };

  const stats = calculateStats();

  // Get status badge color - UPDATED: Include to-do
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
      case 'to-do': // ADDED
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // ADDED: Open lightbox with images
  const openLightbox = (images: string[], startIndex: number = 0) => {
    setLightboxImages(images);
    setCurrentImageIndex(startIndex);
    setLightboxOpen(true);
  };

  // ADDED: Navigate lightbox
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

  // ADDED: Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, handlePrevImage, handleNextImage]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
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

      {/* Project Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Label htmlFor="project-filter" className="whitespace-nowrap">Filter by Project:</Label>
            <Select  value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
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

      {/* Statistics Cards - UPDATED: Added To-Do card */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">To-Do</p>
              <p className="text-2xl font-bold text-purple-600">{stats.toDo}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Delayed</p>
              <p className="text-2xl font-bold text-red-600">{stats.delayed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyProgress.length === 0 ? (
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
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{activity.title}</h3>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusBadgeClass(activity.status)}>
                        {activity.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline">{activity.priority}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
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
                      <p className="text-gray-600">Start Date</p>
                      <p className="font-medium">
                        {new Date(activity.startDate).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">End Date</p>
                      <p className="font-medium">
                        {new Date(activity.endDate).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* UPDATED: Clickable images that open lightbox */}
                  {activity.images && activity.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-2">Images:</p>
                      <div className="flex gap-2 flex-wrap">
                        {activity.images.map((imageUrl, index) => (
                          <div 
                            key={index} 
                            className="relative w-20 h-20 cursor-pointer hover:opacity-80 transition-opacity group"
                            onClick={() => openLightbox(activity.images || [], index)}
                          >
                            <Image
                              src={imageUrl}
                              alt={`Activity image ${index + 1}`}
                              fill
                              className="object-cover rounded border"
                            />
                            {/* Zoom icon overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center rounded">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activity.comments && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">{activity.comments}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Link href={`/manager/site-schedule/activity/${activity._id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog - UPDATED: Added 'to-do' to status options */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

            {/* Basic Information */}
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

            {/* Date and Time */}
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

            {/* Status, Priority, Category - UPDATED: Added 'to-do' option */}
            <div className="grid grid-cols-3 gap-4">
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

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments">Internal Comments</Label>
              <Textarea
                id="comments"
                value={newActivity.comments || ''}
                onChange={(e) => setNewActivity({...newActivity, comments: e.target.value})}
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

      {/* ADDED: Image Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X className="h-8 w-8" />
            </button>

            {/* Previous Button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 text-white hover:text-gray-300 transition-colors z-10"
              >
                <ChevronLeft className="h-12 w-12" />
              </button>
            )}

            {/* Image */}
            <div 
              className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={lightboxImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Next Button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 text-white hover:text-gray-300 transition-colors z-10"
              >
                <ChevronRight className="h-12 w-12" />
              </button>
            )}

            {/* Image Counter */}
            {lightboxImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded-full">
                {currentImageIndex + 1} / {lightboxImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}