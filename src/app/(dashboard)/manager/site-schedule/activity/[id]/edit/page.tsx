// FILE 1: src/app/(dashboard)/manager/site-schedule/activity/[id]/edit/page.tsx
// ✅ CREATED: The missing activity edit page that was causing 404 errors

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle
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
import { formatDate } from '@/lib/utils';

// TypeScript interfaces following the established patterns
interface ActivityFormData {
  title: string;
  description: string;
  contractor: string;
  supervisor: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number;
  actualDuration?: number;
  comments: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  plannedDate: string;
  actualDate?: string;
}

interface ActivityData extends ActivityFormData {
  _id: string;
  projectId: string;
  projectTitle: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Helper functions for styling
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

export default function EditActivityPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  // Extract activity ID from params
  const activityId = params.id as string;

  // State management
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    contractor: '',
    supervisor: '',
    status: 'pending',
    priority: 'medium',
    estimatedDuration: 60,
    actualDuration: undefined,
    comments: '',
    category: 'structural',
    plannedDate: '',
    actualDate: undefined
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      
      // Since we don't have a specific activity endpoint, we'll need to fetch from daily progress
      // This is a simplified approach - in production, you'd want a dedicated endpoint
      const response = await fetch(`/api/site-schedule/activity/${activityId}`);
      
      if (response.ok) {
        const data = await response.json();
        const activityData = data.data;
        
        setActivity(activityData);
        setFormData({
          title: activityData.title || '',
          description: activityData.description || '',
          contractor: activityData.contractor || '',
          supervisor: activityData.supervisor || '',
          status: activityData.status || 'pending',
          priority: activityData.priority || 'medium',
          estimatedDuration: activityData.estimatedDuration || 60,
          actualDuration: activityData.actualDuration || undefined,
          comments: activityData.comments || '',
          category: activityData.category || 'structural',
          plannedDate: activityData.plannedDate ? new Date(activityData.plannedDate).toISOString().split('T')[0] : '',
          actualDate: activityData.actualDate ? new Date(activityData.actualDate).toISOString().split('T')[0] : undefined
        });
      } else {
        // If specific endpoint doesn't exist, show a message but don't break
        toast({
          variant: "destructive",
          title: "Activity Not Found",
          description: "The requested activity could not be loaded. It may have been deleted or moved.",
        });
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activity data. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [activityId, toast]);

  // Update form data
  const updateFormData = (field: keyof ActivityFormData, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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

    try {
      setSaving(true);

      // Prepare update data
      const updateData = {
        projectId: activity.projectId,
        date: activity.plannedDate.split('T')[0], // Extract date part
        activityId: activity._id,
        updates: {
          ...formData,
          actualDate: formData.status === 'completed' ? (formData.actualDate || new Date().toISOString()) : formData.actualDate
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
        
        // Redirect back to daily activities or site schedule
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

  // Load activity on mount
  useEffect(() => {
    if (activityId) {
      fetchActivity();
    }
  }, [fetchActivity]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Activity not found state
  if (!activity && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Daily Activities
            </Button>
          </Link>
        </div>
        
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Not Found</h3>
            <p className="text-gray-600 mb-4">
              The requested activity could not be found. It may have been deleted or moved.
            </p>
            <Link href="/manager/site-schedule/daily">
              <Button>Return to Daily Activities</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Daily Activities
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Activity</h1>
            <p className="text-gray-600 mt-1">Modify activity details and track progress</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {activity && (
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(activity.status)}>
                {activity.status.replace('_', ' ')}
              </Badge>
              <Badge className={getPriorityColor(activity.priority)}>
                {activity.priority}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Activity Information */}
      {activity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Activity Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Project:</span>
                <p className="text-gray-900">{activity.projectTitle}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Created:</span>
                <p className="text-gray-900">{formatDate(new Date(activity.createdAt))}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Last Updated:</span>
                <p className="text-gray-900">{formatDate(new Date(activity.updatedAt))}</p>
              </div>
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
                  onChange={(e) => updateFormData('title', e.target.value)}
                  placeholder="e.g., Foundation excavation"
                />
              </div>

              <div>
                <Label htmlFor="contractor">Contractor *</Label>
                <Input
                  id="contractor"
                  value={formData.contractor}
                  onChange={(e) => updateFormData('contractor', e.target.value)}
                  placeholder="e.g., ABC Construction"
                />
              </div>

              <div>
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={formData.supervisor}
                  onChange={(e) => updateFormData('supervisor', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value: ActivityFormData['category']) => updateFormData('category', value)}
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

            {/* Status and Progress */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: ActivityFormData['status']) => updateFormData('status', value)}
                >
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

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value: ActivityFormData['priority']) => updateFormData('priority', value)}
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
                <Label htmlFor="plannedDate">Planned Date</Label>
                <Input
                  id="plannedDate"
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => updateFormData('plannedDate', e.target.value)}
                />
              </div>

              {formData.status === 'completed' && (
                <div>
                  <Label htmlFor="actualDate">Actual Completion Date</Label>
                  <Input
                    id="actualDate"
                    type="date"
                    value={formData.actualDate || ''}
                    onChange={(e) => updateFormData('actualDate', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  value={formData.estimatedDuration}
                  onChange={(e) => updateFormData('estimatedDuration', parseInt(e.target.value) || 60)}
                  min="15"
                  step="15"
                />
              </div>

              {(formData.status === 'completed' || formData.status === 'in_progress') && (
                <div>
                  <Label htmlFor="actualDuration">Actual Duration (minutes)</Label>
                  <Input
                    id="actualDuration"
                    type="number"
                    value={formData.actualDuration || ''}
                    onChange={(e) => updateFormData('actualDuration', parseInt(e.target.value) || undefined)}
                    min="0"
                    step="15"
                    placeholder="Leave empty if not completed"
                  />
                </div>
              )}
            </div>

            {/* Description and Comments */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Describe the activity details..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => updateFormData('comments', e.target.value)}
                  placeholder="Add any additional comments or notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
            <Link href="/manager/site-schedule/daily">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.title.trim() || !formData.contractor.trim()}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}