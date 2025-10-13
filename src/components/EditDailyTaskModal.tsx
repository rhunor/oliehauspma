// src/components/EditDailyTaskModal.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  X,
  Loader2,
  Image as ImageIcon,
  Send,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';

// ==================== TYPES & INTERFACES ====================

interface DailyActivity {
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  comments?: string;
  images?: string[];
  progress?: number;
  projectId?: string;
  projectTitle?: string;
  date?: string;
}

interface ClientComment {
  _id?: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}

interface EditDailyTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: DailyActivity | null;
  projectId: string;
  date: string;
  onSuccess: () => void;
}

// ==================== ZOD SCHEMA ====================

const editTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  contractor: z.string().min(1, 'Contractor is required'),
  supervisor: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.enum(['to-do', 'pending', 'in_progress', 'completed', 'delayed', 'on_hold']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.enum(['structural', 'electrical', 'plumbing', 'finishing', 'other']).optional(),
  comments: z.string().max(500, 'Comments too long').optional(),
  progress: z.number().min(0).max(100).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

type EditTaskFormData = z.infer<typeof editTaskSchema>;

// ==================== HELPER FUNCTIONS ====================

const formatDateTimeLocal = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'to-do': 'bg-purple-100 text-purple-800',
    'pending': 'bg-gray-100 text-gray-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'delayed': 'bg-red-100 text-red-800',
    'on_hold': 'bg-yellow-100 text-yellow-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    'low': 'bg-gray-100 text-gray-700',
    'medium': 'bg-blue-100 text-blue-700',
    'high': 'bg-orange-100 text-orange-700',
    'urgent': 'bg-red-100 text-red-700',
  };
  return colors[priority] || 'bg-gray-100 text-gray-700';
};

// ==================== MAIN COMPONENT ====================

export default function EditDailyTaskModal({
  open,
  onOpenChange,
  activity,
  projectId,
  date,
  onSuccess,
}: EditDailyTaskModalProps) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const userRole = session?.user?.role as 'super_admin' | 'project_manager' | 'client' | undefined;
  const canEdit = userRole === 'super_admin' || userRole === 'project_manager';

  // Initialize form with react-hook-form + zod
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EditTaskFormData>({
    resolver: zodResolver(editTaskSchema),
  });

  const watchedStatus = watch('status');

  // Load activity data when modal opens
  useEffect(() => {
    if (activity && open) {
      reset({
        title: activity.title,
        description: activity.description || '',
        contractor: activity.contractor,
        supervisor: activity.supervisor || '',
        startDate: formatDateTimeLocal(activity.startDate),
        endDate: formatDateTimeLocal(activity.endDate),
        status: activity.status,
        priority: activity.priority,
        category: activity.category || 'structural',
        comments: activity.comments || '',
        progress: activity.progress || 0,
      });
      
      // Fetch comments if activity has clientComments support
      if (activity._id) {
        loadComments(activity._id);
      }
    }
  }, [activity, open, reset]);

  // Load comments for the activity
  const loadComments = async (activityId: string) => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/site-schedule/daily/${activityId}/comments`);
      if (response.ok) {
        const data = await response.json();
        // Ensure comments is always an array
        setComments(Array.isArray(data.data) ? data.data : []);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle form submission
  const onSubmit = async (formData: EditTaskFormData) => {
    if (!activity || !canEdit) return;

    setSaving(true);
    try {
      const response = await fetch('/api/site-schedule/daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          date,
          activityId: activity._id,
          updates: {
            ...formData,
            progress: formData.status === 'completed' ? 100 : formData.progress,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update activity');
      }

      toast({
        title: 'Success',
        description: 'Activity updated successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update activity',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle adding comment
  const handleAddComment = async () => {
    if (!activity || !newComment.trim()) return;

    setAddingComment(true);
    try {
      const response = await fetch(`/api/site-schedule/daily/${activity._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add comment');
      }

      const data = await response.json();
      setComments(data.data || []);
      setNewComment('');
      
      toast({
        title: 'Success',
        description: 'Comment added successfully',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add comment',
      });
    } finally {
      setAddingComment(false);
    }
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {canEdit ? 'Edit Activity' : 'View Activity'}
          </DialogTitle>
          <DialogDescription>
            {canEdit 
              ? 'Update activity details and track progress'
              : 'View activity details and add comments'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="Enter activity title"
                  disabled={!canEdit}
                />
                {errors.title && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Enter activity description"
                  rows={3}
                  disabled={!canEdit}
                />
                {errors.description && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractor">
                  Contractor <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contractor"
                  {...register('contractor')}
                  placeholder="Contractor name"
                  disabled={!canEdit}
                />
                {errors.contractor && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.contractor.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  {...register('supervisor')}
                  placeholder="Supervisor name"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Schedule</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  Start Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  {...register('startDate')}
                  disabled={!canEdit}
                />
                {errors.startDate && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.startDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">
                  End Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  {...register('endDate')}
                  disabled={!canEdit}
                />
                {errors.endDate && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Status & Priority */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Status & Priority</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watchedStatus}
                  onValueChange={(value) => setValue('status', value as EditTaskFormData['status'])}
                  disabled={!canEdit}
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
                {errors.status && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.status.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch('priority')}
                  onValueChange={(value) => setValue('priority', value as EditTaskFormData['priority'])}
                  disabled={!canEdit}
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
                {errors.priority && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.priority.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value as EditTaskFormData['category'])}
                  disabled={!canEdit}
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
          </div>

          {/* Progress */}
          {watchedStatus !== 'completed' && canEdit && (
            <div className="space-y-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                {...register('progress', { valueAsNumber: true })}
                placeholder="0-100"
                disabled={!canEdit}
              />
              {errors.progress && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.progress.message}
                </p>
              )}
            </div>
          )}

          {/* Internal Comments */}
          {canEdit && (
            <div className="space-y-2">
              <Label htmlFor="comments">Internal Comments</Label>
              <Textarea
                id="comments"
                {...register('comments')}
                placeholder="Add internal notes for managers and admins"
                rows={3}
                disabled={!canEdit}
              />
              {errors.comments && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.comments.message}
                </p>
              )}
            </div>
          )}

          {/* Images Gallery */}
          {activity.images && activity.images.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Attached Images
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {activity.images.map((imageUrl, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                    <Image
                      src={imageUrl}
                      alt={`Activity image ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client Comments Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Comments & Discussion</h3>
            
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <Card key={comment._id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{comment.userName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {comment.userRole}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Add Comment */}
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddComment}
                disabled={!newComment.trim() || addingComment}
                size="sm"
              >
                {addingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            
            {canEdit && (
              <Button type="submit" disabled={saving}>
                {saving ? (
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
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}