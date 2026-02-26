"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Edit,
  Save,
  Clock,
  User,
  Loader2,
  Image as ImageIcon,
  Send,
  Calendar,
  AlertCircle,
  Trash2,
} from 'lucide-react';

// ==================== TYPES & INTERFACES ====================

interface DailyActivity {
  _id: string;
  title: string;
  description?: string;
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

interface ActivityModalProps {
  activity: DailyActivity | null;
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  date: string;
  onSuccess: () => void;
  userRole?: 'admin' | 'manager' | 'client';
}

// ==================== ZOD SCHEMA ====================

const activitySchema = z.object({
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

type EditActivityFormData = z.infer<typeof activitySchema>;

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

const getStatusBadgeClass = (status: string): string => {
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

export default function ActivityModal({
  activity,
  isOpen,
  onClose,
  projectId,
  date,
  onSuccess,
  userRole = 'admin',
}: ActivityModalProps) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = (session?.user?.role as 'super_admin' | 'project_manager' | 'client' | undefined) === 'super_admin' || 
                  (session?.user?.role as 'super_admin' | 'project_manager' | 'client' | undefined) === 'project_manager' ||
                  userRole === 'admin' || userRole === 'manager';

  // Admin-only delete capability
  const canDelete = (session?.user?.role as 'super_admin' | 'project_manager' | 'client' | undefined) === 'super_admin' || userRole === 'admin';

  // Delete confirmation modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentImages = (activity?.images || []).filter((url) => !imagesToDelete.includes(url));

  // Initialize form
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EditActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      description: '',
      contractor: '',
      supervisor: '',
      startDate: '',
      endDate: '',
      status: 'to-do',
      priority: 'medium',
      category: 'structural',
      comments: '',
      progress: 0,
    },
  });

  const watchedStatus = watch('status');

  // Load data on open
  useEffect(() => {
    if (activity && isOpen) {
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
      setImagesToDelete([]);
      setSelectedImages([]);
      setImagePreviews([]);
      loadComments(activity._id);
    }
  }, [activity, isOpen, reset]);

  // Load comments
  const loadComments = useCallback(async (activityId: string) => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/site-schedule/daily/${activityId}/comments`);
      if (response.ok) {
        const data = await response.json();
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
  }, []);

  // Image handlers
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeSelectedImage = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeExistingImage = useCallback((url: string) => {
    setImagesToDelete((prev) => [...prev, url]);
  }, []);

  const uploadImages = useCallback(async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];
    setUploadingImages(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of selectedImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'site-activities');
        formData.append('projectId', projectId); // For key organization
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        } else {
          throw new Error('Upload failed for one or more files');
        }
      }
      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload images' });
      return [];
    } finally {
      setUploadingImages(false);
      setSelectedImages([]); // Clear after upload
      setImagePreviews([]); // Clear previews
    }
  }, [selectedImages, projectId, toast]);

  // Submit form
  const onSubmit = useCallback(
    async (formData: EditActivityFormData) => {
      if (!activity || !canEdit) return;
      setSaving(true);
      try {
        const imageUrls = await uploadImages();
        const actualDate = activity.date || date; // Use activity date if exists for match
        const response = await fetch('/api/site-schedule/daily', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            date: actualDate,
            activityId: activity._id,
            updates: {
              ...formData,
              images: [...currentImages, ...imageUrls],
              progress: formData.status === 'completed' ? 100 : formData.progress,
            },
            deleteImages: imagesToDelete,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update activity');
        }
        const data = await response.json(); // Assume returns updated DailyProgress
        toast({ title: 'Success', description: 'Activity updated successfully' });
        onSuccess(); // Triggers refetch
        setEditMode(false);
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
    },
    [activity, canEdit, projectId, date, currentImages, imagesToDelete, uploadImages, toast, onSuccess]
  );

  // Add comment
  const handleAddComment = useCallback(async () => {
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
      toast({ title: 'Success', description: 'Comment added successfully' });
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
  }, [activity, newComment, toast]);

  // Lightbox handlers (custom implementation)
  const openLightbox = useCallback((index: number = 0) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  }, []);

  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === 0 ? currentImages.length - 1 : prev - 1));
  }, [currentImages.length]);

  const handleNextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === currentImages.length - 1 ? 0 : prev + 1));
  }, [currentImages.length]);

  // Keyboard for lightbox
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

  // Delete activity handler (admin only)
  const handleDeleteActivity = useCallback(async (): Promise<void> => {
    if (!activity || !canDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/site-schedule/activity/${activity._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete activity' }));
        throw new Error(errorData.error || 'Failed to delete activity');
      }
      toast({ title: 'Deleted', description: 'Activity deleted successfully' });
      setConfirmDeleteOpen(false);
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete activity' });
    } finally {
      setDeleting(false);
    }
  }, [activity, canDelete, toast, onClose, onSuccess]);

  if (!activity) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold">
                {activity.title}
              </DialogTitle>
              {activity.description && (
                <p className="text-sm text-gray-600 mt-2">{activity.description}</p>
              )}
              <div className="mt-3">
                <Badge className={getStatusBadgeClass(activity.status)}>
                  {activity.status.replace('_', ' ').replace('-', ' ')}
                </Badge>
              </div>
            </div>
            <DialogDescription>
              {editMode ? 'Edit activity details' : canEdit ? 'View and edit activity' : 'View activity and add comments'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Contractor
                </p>
                <Input
                  {...register('contractor')}
                  value={watch('contractor')}
                  disabled={!editMode || !canEdit}
                  className="font-medium mt-1"
                />
              </div>
              {activity.supervisor && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Supervisor
                  </p>
                  <Input
                    {...register('supervisor')}
                    value={watch('supervisor')}
                    disabled={!editMode || !canEdit}
                    className="font-medium mt-1"
                  />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Start Date
                </p>
                <Input
                  type="datetime-local"
                  {...register('startDate')}
                  disabled={!editMode || !canEdit}
                  className="font-medium mt-1 text-sm"
                  suppressHydrationWarning
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  End Date
                </p>
                <Input
                  type="datetime-local"
                  {...register('endDate')}
                  disabled={!editMode || !canEdit}
                  className="font-medium mt-1 text-sm"
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Priority & Category */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={watch('priority')} 
                  onValueChange={(value: string) => setValue('priority', value as EditActivityFormData['priority'])} 
                  disabled={!editMode || !canEdit}
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
                <Badge className={getPriorityColor(watch('priority'))} variant="outline">
                  {watch('priority')}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={watch('category')} 
                  onValueChange={(value: string) => setValue('category', value as EditActivityFormData['category'])} 
                  disabled={!editMode || !canEdit}
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
              {editMode && watchedStatus !== 'completed' && canEdit && (
                <div className="space-y-2">
                  <Label>Progress (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register('progress', { valueAsNumber: true })}
                    disabled={!canEdit}
                  />
                </div>
              )}
            </div>

            {/* Status Select (inline for view, form for edit) */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(value: string) => setValue('status', value as EditActivityFormData['status'])}
                disabled={!editMode && !canEdit}
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
              <Badge className={getStatusBadgeClass(watch('status'))}>
                {watch('status').replace('_', ' ').replace('-', ' ')}
              </Badge>
            </div>

            {/* Images Section */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <ImageIcon className="h-4 w-4" />
                Activity Images ({currentImages.length + selectedImages.length})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {currentImages.map((imageUrl, index) => (
                  <div
                    key={imageUrl}
                    className="relative aspect-square cursor-pointer hover:opacity-80 group rounded-lg overflow-hidden border border-gray-200"
                    onClick={() => openLightbox(currentImages.indexOf(imageUrl))}
                  >
                    <Image src={imageUrl} alt={`Activity image ${index + 1}`} fill className="object-cover" />
                    {editMode && canEdit && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExistingImage(imageUrl);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeSelectedImage(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {editMode && canEdit && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Add Images
                    </Button>
                  </label>
                </>
              )}
            </div>

            {/* Internal Comments */}
            <div className="space-y-2">
              <Label>Internal Comments</Label>
              <Textarea
                {...register('comments')}
                placeholder="Add internal notes"
                rows={3}
                disabled={!editMode || !canEdit}
              />
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Comments</h3>
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <Card key={comment._id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{comment.userName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {comment.userRole}
                                  </Badge>
                                </div>
                                <span className="text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 inline mr-1" />
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
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddComment} disabled={!newComment.trim() || addingComment} size="sm">
                  {addingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              {canDelete && !editMode && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Activity
                    </>
                  )}
                </Button>
              )}
              {canEdit && !editMode && (
                <Button type="button" variant="outline" onClick={() => setEditMode(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {editMode && canEdit && (
                <Button type="submit" disabled={saving || uploadingImages}>
                  {saving || uploadingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Delete activity?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the activity and remove its data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteActivity} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Lightbox */}
      {lightboxOpen && currentImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
              aria-label="Close lightbox"
            >
              <X className="h-8 w-8" />
            </button>

            {currentImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-12 w-12" />
              </button>
            )}

            <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <Image
                src={currentImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1} of ${currentImages.length}`}
                fill
                className="object-contain"
                priority
              />
            </div>

            {currentImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                aria-label="Next image"
              >
                <ChevronRight className="h-12 w-12" />
              </button>
            )}

            {currentImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 px-6 py-3 rounded-full text-sm font-medium">
                {currentImageIndex + 1} / {currentImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}