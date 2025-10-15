"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar, 
  Clock,
  User,
  MessageSquare,
  Send,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import ActivityModal from '@/components/ActivityModal';

// UPDATED: TypeScript interfaces with 'to-do' status
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
  comments?: string;
  images?: string[];
  projectTitle: string;
  date: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ClientComment {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}

interface ActivityWithComments extends DailyActivity {
  clientComments: ClientComment[];
  totalComments: number;
}

export default function ClientSiteSchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [activities, setActivities] = useState<ActivityWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/site-schedule/activities?manager=false', { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const activitiesWithComments = data.data.map((activity: DailyActivity) => ({
            ...activity,
            clientComments: [],
            totalComments: 0
          }));
          setActivities(activitiesWithComments);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load activities',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchComments = useCallback(async (activityId: string) => {
    setLoadingComments(prev => ({ ...prev, [activityId]: true }));
    
    try {
      const response = await fetch(`/api/site-schedule/daily/${activityId}/comments`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setActivities(prev => prev.map(activity => 
            activity._id === activityId 
              ? {
                  ...activity,
                  clientComments: data.data.comments || [],
                  totalComments: data.data.totalComments || 0
                }
              : activity
          ));
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load comments',
      });
    } finally {
      setLoadingComments(prev => ({ ...prev, [activityId]: false }));
    }
  }, [toast]);

  const toggleActivity = async (activityId: string) => {
    if (expandedActivity === activityId) {
      setExpandedActivity(null);
    } else {
      setExpandedActivity(activityId);
      
      const activity = activities.find(a => a._id === activityId);
      if (activity && activity.clientComments.length === 0) {
        await fetchComments(activityId);
      }
    }
  };

  const handleSubmitComment = async (activityId: string) => {
    const content = commentText[activityId]?.trim();
    
    if (!content) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a comment',
      });
      return;
    }

    if (content.length > 1000) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Comment must be less than 1000 characters',
      });
      return;
    }

    setSubmittingComment(prev => ({ ...prev, [activityId]: true }));

    try {
      const response = await fetch(`/api/site-schedule/daily/${activityId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          setActivities(prev => prev.map(activity => 
            activity._id === activityId 
              ? {
                  ...activity,
                  clientComments: [...activity.clientComments, data.data],
                  totalComments: activity.totalComments + 1
                }
              : activity
          ));

          setCommentText(prev => ({ ...prev, [activityId]: '' }));

          toast({
            title: 'Success',
            description: 'Comment added successfully',
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add comment',
      });
    } finally {
      setSubmittingComment(prev => ({ ...prev, [activityId]: false }));
    }
  };

  const handleDeleteComment = async (activityId: string, commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/site-schedule/daily/${activityId}/comments?commentId=${commentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setActivities(prev => prev.map(activity => 
          activity._id === activityId 
            ? {
                ...activity,
                clientComments: activity.clientComments.filter(c => c._id !== commentId),
                totalComments: Math.max(0, activity.totalComments - 1)
              }
            : activity
        ));

        toast({
          title: 'Success',
          description: 'Comment deleted successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete comment',
      });
    }
  };

  const handleActivityClick = (activity: DailyActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleSuccess = useCallback(() => {
    fetchActivities(); // Refetch after comment
  }, [fetchActivities]);

  useEffect(() => {
    if (session) {
      fetchActivities();
    }
  }, [session, fetchActivities]);

  // UPDATED: Helper function with 'to-do' status
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'to-do': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-blue-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Site Activities</h1>
        <p className="text-gray-600 mt-1">View daily activities and provide feedback</p>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activities Yet</h3>
            <p className="text-gray-600">There are no activities scheduled at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <Card key={activity._id} className="overflow-hidden cursor-pointer" onClick={() => handleActivityClick(activity)}>
              <CardHeader className="bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{activity.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{activity.projectTitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadgeClass(activity.status)}>
                      {activity.status.replace('_', ' ').replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Activity Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Contractor</p>
                      <p className="text-sm text-gray-900">{activity.contractor}</p>
                    </div>
                  </div>

                  {activity.supervisor && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Supervisor</p>
                        <p className="text-sm text-gray-900">{activity.supervisor}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Start Date</p>
                      <p className="text-sm text-gray-900">{formatDate(activity.startDate)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">End Date</p>
                      <p className="text-sm text-gray-900">{formatDate(activity.endDate)}</p>
                    </div>
                  </div>
                </div>

                {activity.description && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{activity.description}</p>
                  </div>
                )}

                {/* Activity Images */}
                {activity.images && activity.images.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Activity Images</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {activity.images.map((imageUrl, index) => (
                        <div key={index} className="relative w-full h-32">
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
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-sm font-medium text-gray-600 mb-1">Internal Notes</p>
                    <p className="text-sm text-gray-700">{activity.comments}</p>
                  </div>
                )}

                {/* Comments Section (moved to modal; placeholder) */}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold">Comments ({activity.totalComments})</h3>
                  </div>
                  <p className="text-sm text-gray-500">Click to view and add comments</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <ActivityModal
        activity={selectedActivity}
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        projectId={selectedActivity?.projectId || ''}
        date={selectedActivity?.date || ''}
        onSuccess={handleSuccess}
        userRole="client"
      />
    </div>
  );
}