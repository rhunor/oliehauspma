// src/app/(dashboard)/manager/site-schedule/daily/page.tsx - UPDATED: Added startDate, endDate, image upload; Removed duration
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';

// UPDATED: TypeScript interfaces with new fields
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
  startDate: string; // ADDED: Required start date-time
  endDate: string;   // ADDED: Required end date-time
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: string[]; // ADDED: S3 image URLs
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  // REMOVED: estimatedDuration and actualDuration
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
    // REMOVED: totalHours
    crewSize?: number;
    weatherConditions?: string;
  };
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ADDED: Helper function to format datetime-local input value
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

  // State management
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // UPDATED: New activity state with new required fields
  const [newActivity, setNewActivity] = useState<Partial<DailyActivity>>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    startDate: formatDateTimeLocal(new Date()), // ADDED: Default to current time
    endDate: formatDateTimeLocal(new Date(Date.now() + 3600000)), // ADDED: Default to 1 hour from now
    status: 'pending',
    priority: 'medium',
    category: 'other',
    comments: ''
  });

  // ADDED: Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Fetch projects managed by current user
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?limit=100&role=manager');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.projects) {
          setProjects(data.data.projects);
          if (data.data.projects.length > 0 && !selectedProject) {
            setSelectedProject(data.data.projects[0]._id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load projects",
      });
    }
  }, [selectedProject, toast]);

  // Fetch daily progress
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

  // ADDED: Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB max
      
      if (!isImage) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: `${file.name} is not an image file`,
        });
        return false;
      }
      
      if (!isValidSize) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} exceeds 10MB limit`,
        });
        return false;
      }
      
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
    
    // Generate previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ADDED: Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  // ADDED: Upload images to S3
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

  // UPDATED: Add activity with validation for new required fields
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

    // ADDED: Validate start and end dates
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
      // ADDED: Upload images first
      const imageUrls = await uploadImages();

      const activityData = {
        ...newActivity,
        project: selectedProject,
        createdBy: session?.user?.id,
        images: imageUrls, // ADDED: Include uploaded image URLs
        // REMOVED: estimatedDuration and actualDuration
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
        const now = new Date();
        setNewActivity({
          title: '',
          description: '',
          contractor: '',
          supervisor: '',
          startDate: formatDateTimeLocal(now),
          endDate: formatDateTimeLocal(new Date(now.getTime() + 3600000)),
          status: 'pending',
          priority: 'medium',
          category: 'other',
          comments: ''
        });
        setSelectedProject('all');
        setSelectedImages([]);
        setImagePreview([]);
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

  // Calculate statistics
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

  // Get status badge color
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
      {/* Header */}
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
        
        {/* Add Activity Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Daily Activity</DialogTitle>
              <DialogDescription>
                Create a new activity to track daily site progress
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              {/* Project and Date Selection */}
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
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Activity Title *</Label>
                  <Input
                    id="title"
                    value={newActivity.title || ''}
                    onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                    placeholder="e.g., Foundation concrete pouring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newActivity.description || ''}
                    onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                    placeholder="Detailed description of the activity..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Contractor and Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractor">Contractor *</Label>
                  <Input
                    id="contractor"
                    value={newActivity.contractor || ''}
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

              {/* ADDED: Start and End Date-Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time *</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={newActivity.startDate || ''}
                    onChange={(e) => setNewActivity({...newActivity, startDate: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time *</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={newActivity.endDate || ''}
                    onChange={(e) => setNewActivity({...newActivity, endDate: e.target.value})}
                    required
                  />
                </div>
              </div>

              {/* Priority, Status, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
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

              {/* ADDED: Image Upload Section */}
              <div className="space-y-2">
                <Label>Activity Images</Label>
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
                {uploadingImages ? 'Uploading Images...' : 'Add Activity'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
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
                    {/* ADDED: Display start and end dates */}
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

                  {/* ADDED: Display images */}
                  {activity.images && activity.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-2">Images:</p>
                      <div className="flex gap-2 flex-wrap">
                        {activity.images.map((imageUrl, index) => (
                          <div key={index} className="relative w-20 h-20">
                            <Image
                              src={imageUrl}
                              alt={`Activity image ${index + 1}`}
                              fill
                              className="object-cover rounded border"
                            />
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
    </div>
  );
}