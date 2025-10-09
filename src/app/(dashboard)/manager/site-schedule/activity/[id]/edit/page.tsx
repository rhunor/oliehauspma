// src/app/(dashboard)/manager/site-schedule/activity/[id]/edit/page.tsx
// UPDATED: Added 'to-do' status, enhanced image management with upload capability

"use client";

import { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Clock, 
  User,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ImageIcon,
  X,
  Upload,
  Plus
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
import { useToast } from '@/hooks/use-toast';

// UPDATED: TypeScript interfaces with 'to-do' status
interface ActivityFormData {
  title: string;
  description: string;
  contractor: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  comments: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  images: string[];
}

interface ActivityData extends ActivityFormData {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ActivityResponse {
  success: boolean;
  data?: ActivityData;
  error?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper function to format datetime-local input value
const formatDateTimeLocal = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function EditActivityPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const activityId = resolvedParams.id;
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ADDED: New image upload state
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    startDate: formatDateTimeLocal(new Date()),
    endDate: formatDateTimeLocal(new Date(Date.now() + 3600000)),
    status: 'to-do', // UPDATED: Default to 'to-do'
    priority: 'medium',
    comments: '',
    category: 'structural',
    images: []
  });

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/site-schedule/daily/activities/${activityId}`);
      
      if (response.ok) {
        const data: ActivityResponse = await response.json();
        const activityData = data.data;
        
        if (activityData) {
          setActivity(activityData);
          setFormData({
            title: activityData.title || '',
            description: activityData.description || '',
            contractor: activityData.contractor || '',
            supervisor: activityData.supervisor || '',
            startDate: activityData.startDate ? formatDateTimeLocal(activityData.startDate) : formatDateTimeLocal(new Date()),
            endDate: activityData.endDate ? formatDateTimeLocal(activityData.endDate) : formatDateTimeLocal(new Date(Date.now() + 3600000)),
            status: activityData.status || 'to-do',
            priority: activityData.priority || 'medium',
            comments: activityData.comments || '',
            category: activityData.category || 'structural',
            images: activityData.images || []
          });
        } else {
          toast({
            variant: "destructive",
            title: "Activity Not Found",
            description: "The requested activity could not be loaded.",
          });
          router.push('/manager/site-schedule/daily');
        }
      } else {
        throw new Error('Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activity data. Please try again.",
      });
      router.push('/manager/site-schedule/daily');
    } finally {
      setLoading(false);
    }
  }, [activityId, toast, router]);

  useEffect(() => {
    if (activityId) {
      fetchActivity();
    }
  }, [activityId, fetchActivity]);

  // Update form data - Type-safe field updates
  const updateFormField = <K extends keyof ActivityFormData>(
    field: K,
    value: ActivityFormData[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ADDED: Handle new image selection
  const handleNewImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setNewImages(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ADDED: Remove new image preview
  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Remove existing image
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // ADDED: Upload new images to S3
  const uploadNewImages = async (): Promise<string[]> => {
    if (newImages.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of newImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', activity?.projectId || '');
        formData.append('description', 'Activity image');
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

  // Save activity changes
  const handleSave = async (): Promise<void> => {
    if (!activity || !formData.title.trim() || !formData.contractor.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields (Title and Contractor).",
      });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Start Date and End Date are required.",
      });
      return;
    }

    const startDateTime = new Date(formData.startDate);
    const endDateTime = new Date(formData.endDate);

    if (endDateTime <= startDateTime) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "End Date must be after Start Date.",
      });
      return;
    }

    try {
      setSaving(true);

      // ADDED: Upload new images first
      const newImageUrls = await uploadNewImages();
      const allImages = [...formData.images, ...newImageUrls];

      // Prepare update data
      const updateData = {
        projectId: activity.projectId,
        date: activity.date,
        activityId: activity._id,
        updates: {
          title: formData.title,
          description: formData.description,
          contractor: formData.contractor,
          supervisor: formData.supervisor,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
          priority: formData.priority,
          category: formData.category,
          comments: formData.comments,
          images: allImages // UPDATED: Include all images (existing + new)
        }
      };

      const response = await fetch('/api/site-schedule/daily', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity updated successfully!",
        });
        
        // Clear new image state
        setNewImages([]);
        setNewImagePreviews([]);
        
        router.push('/manager/site-schedule/daily');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update activity');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update activity. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Activity Not Found</h2>
          <p className="text-gray-600 mb-4">The activity you&apos;re looking for could not be found.</p>
          <Link href="/manager/site-schedule/daily">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Daily Schedule
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Activity</h1>
            <p className="text-sm text-gray-600">Update activity details</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {/* Basic Information */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="title">Task Name *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="e.g., Foundation concrete pouring"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Detailed description..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={formData.contractor}
                  onChange={(e) => updateFormField('contractor', e.target.value)}
                  placeholder="Contractor name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={formData.supervisor}
                  onChange={(e) => updateFormField('supervisor', e.target.value)}
                  placeholder="Supervisor name"
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => updateFormField('startDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => updateFormField('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Status, Priority, Category - UPDATED: Added 'to-do' option */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateFormField('status', value as ActivityFormData['status'])}
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
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => updateFormField('priority', value as ActivityFormData['priority'])}
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
                  value={formData.category}
                  onValueChange={(value) => updateFormField('category', value as ActivityFormData['category'])}
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
                value={formData.comments}
                onChange={(e) => updateFormField('comments', e.target.value)}
                placeholder="Add any internal notes or comments..."
                rows={3}
              />
            </div>

            {/* Existing Images */}
            {formData.images.length > 0 && (
              <div className="md:col-span-2">
                <Label>Current Images</Label>
                <div className="grid grid-cols-4 gap-4 mt-2">
                  {formData.images.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <div className="relative w-full h-32">
                        <Image
                          src={imageUrl}
                          alt={`Activity image ${index + 1}`}
                          fill
                          className="object-cover rounded border"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click the X button to remove an image
                </p>
              </div>
            )}

            {/* ADDED: Add New Images Section */}
            <div className="space-y-2">
              <Label>Add New Images</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNewImageSelect}
                  className="hidden"
                />
                
                {newImagePreviews.length === 0 ? (
                  <div className="text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Upload additional images
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
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {newImagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`New image ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => removeNewImage(index)}
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
                      Add More
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
            <Link href="/manager/site-schedule/daily">
              <Button variant="outline" disabled={saving || uploadingImages}>
                Cancel
              </Button>
            </Link>
            <Button 
              onClick={handleSave} 
              disabled={saving || uploadingImages || !formData.title.trim() || !formData.contractor.trim()}
              className="flex items-center gap-2"
            >
              {uploadingImages ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading Images...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}