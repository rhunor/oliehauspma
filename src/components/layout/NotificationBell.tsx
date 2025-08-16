// src/components/layout/NotificationBell.tsx - FIXED TYPESCRIPT AND MOBILE RESPONSIVE VERSION
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
    _id: string;
    name: string;
  };
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'info' | 'success' | 'warning' | 'error';
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Enhanced mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768;
      const isTouch = 'ontouchstart' in window;
      const viewHeight = window.innerHeight;
      
      setIsMobile(isMobileDevice || isTouch);
      setViewportHeight(viewHeight);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Enhanced positioning calculation for mobile
  const getDropdownPosition = useCallback(() => {
    if (!buttonRef.current || !isMobile) return {};

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 320; // Fixed width for consistency
    const dropdownHeight = Math.min(500, viewportHeight * 0.7); // Max 70% of viewport height

    // Calculate position to ensure dropdown stays within viewport
    let top = buttonRect.bottom + 8;
    let left = buttonRect.right - dropdownWidth;

    // Adjust if dropdown would go off-screen
    if (left < 16) {
      left = 16; // 16px margin from edge
    }
    
    if (top + dropdownHeight > viewportHeight - 16) {
      top = buttonRect.top - dropdownHeight - 8; // Position above button
    }

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      right: 'auto',
      maxHeight: `${dropdownHeight}px`,
      width: `${Math.min(dropdownWidth, window.innerWidth - 32)}px`,
      zIndex: 9999,
    };
  }, [isMobile, viewportHeight]);

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?page=${pageNum}&limit=10`);
      const data = await response.json();

      if (data.success) {
        const newNotifications = data.data.notifications || [];
        setNotifications(prev => append ? [...prev, ...newNotifications] : newNotifications);
        setUnreadCount(data.data.unreadCount || 0);
        setHasMore(newNotifications.length === 10);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notification =>
            notification._id === notificationId
              ? { ...notification, isRead: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen, notifications.length, fetchNotifications]);

  // Fixed TypeScript event handling for click outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Fixed TypeScript for touch events
    const handleTouchOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    if (notification.data?.url) {
      window.location.href = notification.data.url;
    } else if (notification.data?.projectId) {
      const role = session?.user?.role;
      const basePath = role === 'super_admin' ? '/admin' : role === 'project_manager' ? '/manager' : '/client';
      window.location.href = `${basePath}/projects/${notification.data.projectId}`;
    }

    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'milestone':
        return <Clock className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="relative p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-2 border-white rounded-full"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Mobile overlay */}
          {isMobile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
          )}
          
          <div
            ref={dropdownRef}
            className={`absolute bg-white rounded-lg shadow-lg border ${
              isMobile 
                ? 'fixed z-50' 
                : 'right-0 mt-2 w-80 max-w-sm z-50'
            }`}
            style={isMobile ? getDropdownPosition() : {}}
          >
            <Card className="border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 py-3 border-b">
                <CardTitle className="text-base font-semibold">Notifications</CardTitle>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 h-auto p-1"
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div 
                  className={`${
                    isMobile 
                      ? 'max-h-[60vh] overflow-y-auto' 
                      : 'max-h-96 overflow-y-auto'
                  }`}
                  onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                    if (scrollHeight - scrollTop === clientHeight && hasMore && !loading) {
                      loadMore();
                    }
                  }}
                >
                  {loading && notifications.length === 0 ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading notifications...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No notifications yet</p>
                    </div>
                  ) : (
                    <>
                      {notifications.map((notification) => (
                        <div
                          key={notification._id}
                          className={`p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                            !notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                  {formatTimeAgo(new Date(notification.createdAt))}
                                </span>
                                {notification.priority === 'urgent' && (
                                  <Badge variant="destructive" className="text-xs">
                                    Urgent
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {hasMore && (
                        <div className="p-3 text-center border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadMore}
                            disabled={loading}
                            className="text-sm"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                Loading...
                              </>
                            ) : (
                              'Load more'
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}