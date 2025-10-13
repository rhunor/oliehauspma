// src/app/(dashboard)/manager/site-schedule/activity/[id]/edit/page.tsx
// FIXED: Correct API endpoints + proper error handling
"use client";

import { use, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, AlertTriangle, Save, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// ==================== TYPES ====================

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
  progress?: number;
}

interface ActivityData extends ActivityFormData {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
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

// ==================== HELPER FUNCTIONS ====================

const formatDateTimeLocal = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// ==================== MAIN COMPONENT ====================

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

  // New image upload state
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
    status: 'to-do',
    priority: 'medium',
    comments: '',
    category: 'structural',
    images: [],
    progress: 0,
  });

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      // FIXED: Correct API endpoint
      const response = await fetch(`/api/site-schedule/activity/${activityId}`);
      
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
            images: activityData.images || [],
            progress: activityData.progress || 0,
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load activity data. Please try again.",
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

  // Update form data
  const updateFormField = <K extends keyof ActivityFormData>(
    field: K,
    value: ActivityFormData[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle new image selection
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

  // Remove new image preview
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

  // Upload new images to S3
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

    setSaving(true);
    try {
      // Upload new images first
      const uploadedUrls = await uploadNewImages();

      // FIXED: Correct API endpoint and request format
      const response = await fetch(`/api/site-schedule/activity/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
            progress: formData.progress,
            images: [...formData.images, ...uploadedUrls]
          }
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity updated successfully",
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="Activity title"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Activity description"
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

            {/* Schedule */}
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

            {/* Status & Priority */}
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

            {/* Progress */}
            {formData.status !== 'completed' && (
              <div className="space-y-2">
                <Label htmlFor="progress">Progress (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => updateFormField('progress', parseInt(e.target.value) || 0)}
                  placeholder="0-100"
                />
              </div>
            )}

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => updateFormField('comments', e.target.value)}
                placeholder="Internal comments"
                rows={3}
              />
            </div>

            {/* Existing Images */}
            {formData.images.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Images</Label>
                <div className="grid grid-cols-3 gap-2">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded border overflow-hidden">
                      <Image
                        src={img}
                        alt={`Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images Upload */}
            <div className="space-y-2">
              <Label>Upload New Images</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNewImageSelect}
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

              {/* New Image Previews */}
              {newImagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded border overflow-hidden">
                      <Image
                        src={preview}
                        alt={`New image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeNewImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Link href="/manager/site-schedule/daily">
              <Button variant="outline" disabled={saving || uploadingImages}>
                Cancel
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={saving || uploadingImages}>
              {uploadingImages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading Images...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
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