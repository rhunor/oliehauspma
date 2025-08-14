// src/components/layout/NotificationBell.tsx - FIXED ALL useEffect DEPENDENCIES
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, X, CheckCircle, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimeAgo } from '@/lib/utils';

interface Notification {
  _id: string;
  type: 'project_update' | 'task_completed' | 'message' | 'milestone' | 'file_upload' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    projectId?: string;
    taskId?: string;
    messageId?: string;
    url?: string;
  };
  sender?: {
    name: string;
    email: string;
  };
}

interface NotificationResponse {
  success: boolean;
  data: Notification[];
  unreadCount: number;
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'project_update':
    case 'milestone':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'task_completed':
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case 'message':
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    case 'file_upload':
      return <Clock className="h-4 w-4 text-orange-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ✅ Memoized fetch function with proper session dependency
  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?page=${pageNum}&limit=10`);
      
      if (response.ok) {
        const data: NotificationResponse = await response.json();
        
        if (append) {
          setNotifications(prev => [...prev, ...data.data]);
        } else {
          setNotifications(data.data);
          setUnreadCount(data.unreadCount);
        }
        
        setHasMore(data.pagination.page < data.pagination.totalPages);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]); // ✅ Include session?.user?.id as dependency

  // ✅ Memoized mark as read function
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, isRead: true }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []); // ✅ No dependencies needed as it only uses stable functions

  // ✅ Memoized mark all as read function
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []); // ✅ No dependencies needed as it only uses stable functions

  // ✅ Memoized notification click handler
  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    
    // Navigate to relevant page if URL is provided
    if (notification.data?.url) {
      window.location.href = notification.data.url;
    }
  }, [markAsRead]); // ✅ Include markAsRead dependency

  // ✅ Memoized load more function
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, true);
    }
  }, [loading, hasMore, fetchNotifications, page]); // ✅ Include all dependencies

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPanel]); // ✅ Only showPanel dependency needed

  // ✅ Fetch notifications on mount and when session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
    }
  }, [session?.user?.id, fetchNotifications]); // ✅ Include both dependencies

  // ✅ Fetch notifications when panel opens (only if no notifications exist)
  useEffect(() => {
    if (showPanel && notifications.length === 0 && session?.user?.id) {
      fetchNotifications();
    }
  }, [showPanel, notifications.length, session?.user?.id, fetchNotifications]); // ✅ Include all dependencies

  // ✅ Poll for new notifications every minute - optimized with ref to avoid dependency issues
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!session?.user?.id) return;

    const pollNotifications = () => {
      fetchNotifications(1, false);
    };

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set new interval
    intervalRef.current = setInterval(pollNotifications, 60000); // Poll every minute
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session?.user?.id, fetchNotifications]); // ✅ Include both dependencies

  if (!session?.user) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setShowPanel(!showPanel)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {showPanel && (
        <Card 
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-96 shadow-lg border z-50 bg-white"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            {notification.sender && (
                              <p className="text-xs text-gray-500">
                                from {notification.sender.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              {formatTimeAgo(new Date(notification.createdAt))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="p-3 text-center border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadMore}
                        disabled={loading}
                        className="text-xs"
                      >
                        {loading ? 'Loading...' : 'Load more'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}