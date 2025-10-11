// src/components/ActivityDetailModal.tsx
// Activity detail modal with role-based access control
// COMPLETE VERSION - NO 'any' types

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  X,
  Edit,
  MessageSquare,
  Image as ImageIcon,
  Calendar,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type {
  Activity,
  UpdateActivityRequest,
  ActivityPermissions,
  AddCommentRequest
} from '@/types/activity';
import { getActivityPermissions } from '@/types/activity';

interface ActivityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  activityId: string;
  onActivityUpdated?: (activity: Activity) => void;
}

export default function ActivityDetailModal({
  isOpen,
  onClose,
  projectId,
  activityId,
  onActivityUpdated
}: ActivityDetailModalProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingComment, setAddingComment] = useState(false);

  // Form state
  const [editForm, setEditForm] = useState<UpdateActivityRequest>({});
  const [newComment, setNewComment] = useState('');

  // Get user permissions
  const permissions: ActivityPermissions = session?.user?.role
    ? getActivityPermissions(session.user.role)
    : {
        canView: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        canUploadImages: false,
        canEditStatus: false,
        canEditDates: false,
        canEditAssignments: false,
      };

  // Fetch activity data
  useEffect(() => {
    if (isOpen && activityId && projectId) {
      fetchActivity();
    }
  }, [isOpen, activityId, projectId]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/activities/${activityId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setActivity(result.data);
        setEditForm({
          title: result.data.title,
          description: result.data.description,
          status: result.data.status,
          priority: result.data.priority,
          category: result.data.category,
          startDate: result.data.startDate,
          endDate: result.data.endDate,
          progress: result.data.progress,
          contractor: result.data.contractor,
          supervisor: result.data.supervisor,
        });
      } else {
        throw new Error(result.error || 'Failed to load activity');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load activity details',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activity) return;

    try {
      setSaving(true);

      const response = await fetch(
        `/api/projects/${projectId}/activities/${activityId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update activity');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setActivity(result.data);
        setIsEditing(false);
        toast({
          title: 'Success',
          description: 'Activity updated successfully',
        });
        onActivityUpdated?.(result.data);
      } else {
        throw new Error(result.error || 'Failed to update activity');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update activity',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setAddingComment(true);

      const commentData: AddCommentRequest = {
        content: newComment.trim(),
        attachments: [],
      };

      const response = await fetch(
        `/api/projects/${projectId}/activities/${activityId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commentData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Add the new comment to activity
        setActivity(prev => {
          if (!prev) return null;
          return {
            ...prev,
            comments: [...prev.comments, result.data],
          };
        });
        setNewComment('');
        toast({
          title: 'Success',
          description: 'Comment added successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add comment',
      });
    } finally {
      setAddingComment(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'to-do':
        return 'bg-gray-100 text-gray-800';
      case 'delayed':
        return 'bg-red-100 text-red-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: Activity['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!permissions.canView) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
            <DialogDescription>
              You do not have permission to view this activity.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              {loading ? 'Loading...' : activity?.title || 'Activity Details'}
            </DialogTitle>
            {permissions.canEdit && !isEditing && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : activity ? (
          <div className="space-y-6">
            {/* Status and Priority */}
            <div className="flex gap-3 flex-wrap">
              <Badge className={getStatusColor(activity.status)}>
                {activity.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={getPriorityColor(activity.priority)}>
                {activity.priority.toUpperCase()} PRIORITY
              </Badge>
              {activity.category && (
                <Badge variant="outline">
                  {activity.category.toUpperCase()}
                </Badge>
              )}
            </div>

            {/* Title (if editing) */}
            {isEditing && permissions.canEdit && (
              <div>
                <Label>Title</Label>
                <Input
                  value={editForm.title || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="mt-2"
                  placeholder="Activity title"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <Label>Description</Label>
              {isEditing && permissions.canEdit ? (
                <Textarea
                  value={editForm.description || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                  className="mt-2"
                  placeholder="Activity description"
                />
              ) : (
                <p className="mt-2 text-gray-700">
                  {activity.description || 'No description provided'}
                </p>
              )}
            </div>

            {/* Dates and Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </Label>
                {isEditing && permissions.canEditDates ? (
                  <Input
                    type="date"
                    value={
                      editForm.startDate
                        ? new Date(editForm.startDate)
                            .toISOString()
                            .split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        startDate: e.target.value,
                      })
                    }
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-gray-700">
                    {formatDate(activity.startDate)}
                  </p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  End Date
                </Label>
                {isEditing && permissions.canEditDates ? (
                  <Input
                    type="date"
                    value={
                      editForm.endDate
                        ? new Date(editForm.endDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        endDate: e.target.value,
                      })
                    }
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-gray-700">
                    {formatDate(activity.endDate)}
                  </p>
                )}
              </div>
            </div>

            {/* Progress */}
            <div>
              <Label>Progress: {isEditing ? (editForm.progress ?? 0) : activity.progress}%</Label>
              {isEditing && permissions.canEdit ? (
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.progress ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      progress: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-2"
                />
              ) : (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all"
                    style={{ width: `${activity.progress}%` }}
                  ></div>
                </div>
              )}
            </div>

            {/* Status (if editing) */}
            {isEditing && permissions.canEditStatus && (
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm({
                      ...editForm,
                      status: value as Activity['status'],
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to-do">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Priority (if editing) */}
            {isEditing && permissions.canEdit && (
              <div>
                <Label>Priority</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(value) =>
                    setEditForm({
                      ...editForm,
                      priority: value as Activity['priority'],
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
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
            )}

            {/* Contractor and Supervisor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contractor
                </Label>
                {isEditing && permissions.canEdit ? (
                  <Input
                    value={editForm.contractor || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, contractor: e.target.value })
                    }
                    className="mt-2"
                    placeholder="Contractor name"
                  />
                ) : (
                  <p className="mt-2 text-gray-700">
                    {activity.contractor || 'Not assigned'}
                  </p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Supervisor
                </Label>
                {isEditing && permissions.canEdit ? (
                  <Input
                    value={editForm.supervisor || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, supervisor: e.target.value })
                    }
                    className="mt-2"
                    placeholder="Supervisor name"
                  />
                ) : (
                  <p className="mt-2 text-gray-700">
                    {activity.supervisor || 'Not assigned'}
                  </p>
                )}
              </div>
            </div>

            {/* Images Section */}
            {activity.images && activity.images.length > 0 && (
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-4 w-4" />
                  Images ({activity.images.length})
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {activity.images.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden border"
                    >
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

            {/* Comments Section */}
            <div className="border-t pt-6">
              <Label className="flex items-center gap-2 mb-4 text-lg">
                <MessageSquare className="h-5 w-5" />
                Comments ({activity.comments.length})
              </Label>

              {/* Comment List */}
              <div className="space-y-4 mb-4">
                {activity.comments.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  activity.comments.map((comment) => (
                    <Card key={comment._id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">
                                {comment.author.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {comment.author.role}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {formatDateTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">
                              {comment.content}
                            </p>
                            {comment.attachments &&
                              comment.attachments.length > 0 && (
                                <div className="mt-2 flex gap-2">
                                  {comment.attachments.map((url, idx) => (
                                    <a
                                      key={idx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      Attachment {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              {permissions.canComment && (
                <div className="border-t pt-4">
                  <Label htmlFor="new-comment">Add a comment</Label>
                  <Textarea
                    id="new-comment"
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts, updates, or questions..."
                    rows={3}
                    className="mt-2"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addingComment}
                      size="sm"
                    >
                      {addingComment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Comment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && permissions.canEdit && (
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      title: activity.title,
                      description: activity.description,
                      status: activity.status,
                      priority: activity.priority,
                      category: activity.category,
                      startDate: activity.startDate,
                      endDate: activity.endDate,
                      progress: activity.progress,
                      contractor: activity.contractor,
                      supervisor: activity.supervisor,
                    });
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600">Activity not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}