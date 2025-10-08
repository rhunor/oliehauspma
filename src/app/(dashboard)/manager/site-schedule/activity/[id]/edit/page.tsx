// src/app/(dashboard)/manager/site-schedule/activity/[id]/edit/page.tsx
// UPDATED: Added startDate, endDate, image display; Removed duration fields

"use client";

import { useState, useEffect, useCallback, use } from 'react';
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
import { useToast } from '@/hooks/use-toast';

// UPDATED: TypeScript interfaces with new fields, removed duration
interface ActivityFormData {
  title: string;
  description: string;
  contractor: string;
  supervisor: string;
  startDate: string; // ADDED: Required start date-time
  endDate: string;   // ADDED: Required end date-time
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  comments: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  images: string[]; // ADDED: S3 image URLs
  // REMOVED: estimatedDuration and actualDuration
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

// Props interface for Next.js 15 dynamic routes
interface PageProps {
  params: Promise<{ id: string }>;
}

// ADDED: Helper function to format datetime-local input value
const formatDateTimeLocal = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper functions for styling
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    case 'on_hold': return 'bg-orange-100 text-orange-800';
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

export default function EditActivityPage({ params }: PageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  // FIXED: Properly unwrap params promise for Next.js 15
  const unwrappedParams = use(params);
  const activityId = unwrappedParams.id;

  // State management
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    startDate: formatDateTimeLocal(new Date()), // ADDED
    endDate: formatDateTimeLocal(new Date(Date.now() + 3600000)), // ADDED
    status: 'pending',
    priority: 'medium',
    comments: '',
    category: 'structural',
    images: [] // ADDED
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/site-schedule/activity/${activityId}`);
      
      if (response.ok) {
        const data: ActivityResponse = await response.json();
        
        if (data.success && data.data) {
          const activityData = data.data;
          
          setActivity(activityData);
          setFormData({
            title: activityData.title || '',
            description: activityData.description || '',
            contractor: activityData.contractor || '',
            supervisor: activityData.supervisor || '',
            startDate: activityData.startDate ? formatDateTimeLocal(activityData.startDate) : formatDateTimeLocal(new Date()),
            endDate: activityData.endDate ? formatDateTimeLocal(activityData.endDate) : formatDateTimeLocal(new Date(Date.now() + 3600000)),
            status: activityData.status || 'pending',
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

  // ADDED: Remove image from form
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
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

    // ADDED: Validate start and end dates
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
          startDate: formData.startDate, // ADDED
          endDate: formData.endDate, // ADDED
          status: formData.status,
          priority: formData.priority,
          category: formData.category,
          comments: formData.comments,
          images: formData.images // ADDED
          // REMOVED: estimatedDuration, actualDuration
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Activity Not Found</h2>
          <p className="text-gray-600 mb-4">The requested activity could not be loaded.</p>
          <Link href="/manager/site-schedule/daily">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Daily Activities
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Activity</h1>
            <p className="text-gray-600 mt-1">Update activity details and status</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(activity.status)}>
            {activity.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColor(activity.priority)}>
            {activity.priority}
          </Badge>
        </div>
      </div>

      {/* Activity Info Card */}
      {activity.projectTitle && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Project:</span>
                <p className="text-gray-900">{activity.projectTitle}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Date:</span>
                <p className="text-gray-900">
                  {new Date(activity.date).toLocaleDateString()}
                </p>
              </div>
              {activity.createdAt && (
                <div>
                  <span className="font-medium text-gray-600">Created:</span>
                  <p className="text-gray-900">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {activity.updatedAt && (
                <div>
                  <span className="font-medium text-gray-600">Last Updated:</span>
                  <p className="text-gray-900">
                    {new Date(activity.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Edit Activity Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Activity Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="e.g., Foundation excavation"
                />
              </div>

              <div>
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={formData.contractor}
                  onChange={(e) => updateFormField('contractor', e.target.value)}
                  placeholder="e.g., ABC Construction"
                />
              </div>

              <div>
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={formData.supervisor}
                  onChange={(e) => updateFormField('supervisor', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>

              {/* ADDED: Start Date & Time */}
              <div>
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => updateFormField('startDate', e.target.value)}
                  required
                />
              </div>

              {/* ADDED: End Date & Time */}
              <div>
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => updateFormField('endDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Status and Category */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateFormField('status', value as ActivityFormData['status'])}
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

              <div>
                <Label htmlFor="priority">Priority *</Label>
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

              <div>
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

              {/* REMOVED: Duration fields */}
            </div>

            {/* Description and Comments */}
            <div className="space-y-4 md:col-span-2">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe the activity details..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="comments">Internal Comments</Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => updateFormField('comments', e.target.value)}
                  placeholder="Add any internal notes or comments..."
                  rows={3}
                />
              </div>
            </div>

            {/* ADDED: Image Display Section */}
            {formData.images.length > 0 && (
              <div className="md:col-span-2">
                <Label>Activity Images</Label>
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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
            <Link href="/manager/site-schedule/daily">
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.title.trim() || !formData.contractor.trim()}
              className="flex items-center gap-2"
            >
              {saving ? (
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