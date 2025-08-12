//src/components/notifications/NotificationPanel.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/utils';

interface NotificationSender {
  _id: string;
  name: string;
  avatar?: string;
}

interface NotificationData {
  projectId?: string;
  taskId?: string;
  messageId?: string;
  fileId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

interface Notification {
  _id: string;
  recipient: string;
  sender?: NotificationSender;
  type: string;
  title: string;
  message: string;
  data?: NotificationData;
  isRead: boolean;
  readAt?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationRead?: () => void;
}

export default function NotificationPanel({ isOpen, onClose, onNotificationRead }: NotificationPanelProps) {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from API using useCallback to prevent dependency issues
  const fetchNotifications = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!session?.user) return;

    try {
      setLoading(pageNum === 1);
      const unreadOnly = filter === 'unread';
      const response = await fetch(
        `/api/notifications?page=${pageNum}&limit=20&unreadOnly=${unreadOnly}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (append) {
          setNotifications(prev => [...prev, ...data.data]);
        } else {
          setNotifications(data.data);
        }
        
        setUnreadCount(data.unreadCount);
        setHasMore(data.pagination.hasNext);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load notifications'
      });
    } finally {
      setLoading(false);
    }
  }, [session?.user, filter, toast]);

  // Mark notification as read
  const markAsRead = async (notificationId: string, isRead: boolean = true) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead })
      });

      if (response.ok) {
        setNotifications(prev => prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, isRead, readAt: isRead ? new Date().toISOString() : undefined }
            : notification
        ));

        setUnreadCount(prev => isRead ? Math.max(0, prev - 1) : prev + 1);
        
        if (onNotificationRead && isRead) {
          onNotificationRead();
        }

        // Emit to socket for real-time updates
        if (socket) {
          socket.emit('mark_notification_read', notificationId);
        }
      }
    } catch (error) {
      console.error('Error updating notification:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update notification'
      });
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const notification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        
        if (notification && !notification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }

        toast({
          title: 'Success',
          description: 'Notification deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete notification'
      });
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    try {
      await Promise.all(
        unreadNotifications.map(notification => 
          markAsRead(notification._id, true)
        )
      );

      toast({
        title: 'Success',
        description: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Navigate to relevant page if URL is provided
    if (notification.data?.url) {
      window.location.href = notification.data.url;
    } else if (notification.data?.projectId) {
      window.location.href = `/admin/projects/${notification.data.projectId}`;
    }
  };

  // Get notification icon and color based on type and category
  const getNotificationStyle = (notification: Notification) => {
    const baseClasses = "w-2 h-2 rounded-full";
    
    switch (notification.category) {
      case 'success': return `${baseClasses} bg-green-500`;
      case 'warning': return `${baseClasses} bg-yellow-500`;
      case 'error': return `${baseClasses} bg-red-500`;
      default: return `${baseClasses} bg-blue-500`;
    }
  };

  // Load more notifications when scrolling to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    if (scrollHeight - scrollTop === clientHeight && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      socket.on('notification_received', (newNotification: Notification) => {
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show toast for new notification
        toast({
          title: newNotification.title,
          description: newNotification.message,
          duration: 5000
        });
      });

      return () => {
        socket.off('notification_received');
      };
    }
  }, [socket, toast]);

  // Fetch notifications when component mounts or filter changes
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchNotifications(1, false);
    }
  }, [isOpen, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
      <div 
        ref={panelRef}
        className="absolute right-4 top-16 w-96 max-h-[80vh] bg-white rounded-lg shadow-xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="default" className="bg-red-500">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Filter and Actions */}
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex gap-1">
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('unread')}
                >
                  Unread ({unreadCount})
                </Button>
              </div>
              
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div 
              className="max-h-96 overflow-y-auto"
              onScroll={handleScroll}
            >
              {loading && notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Indicator */}
                        <div className="flex-shrink-0 mt-2">
                          <div className={getNotificationStyle(notification)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              
                              {/* Sender and Time */}
                              <div className="flex items-center gap-2 mt-2">
                                {notification.sender && (
                                  <span className="text-xs text-gray-500">
                                    from {notification.sender.name}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {formatTimeAgo(new Date(notification.createdAt))}
                                </span>
                                
                                {/* Priority Badge */}
                                {notification.priority === 'high' || notification.priority === 'urgent' ? (
                                  <Badge 
                                    variant={notification.priority === 'urgent' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {notification.priority}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification._id, !notification.isRead);
                                }}
                                title={notification.isRead ? 'Mark as unread' : 'Mark as read'}
                              >
                                {notification.isRead ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification._id);
                                }}
                                title="Delete notification"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {loading && notifications.length > 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Loading more...
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}