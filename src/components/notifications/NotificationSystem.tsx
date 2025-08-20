// src/components/notifications/NotificationSystem.tsx - Fixed Array Type Conflicts
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useSession } from 'next-auth/react';
import { ToastContainer, toast } from 'react-toastify';
import { Bell, X, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import 'react-toastify/dist/ReactToastify.css';

// Unified notification interface to avoid conflicts
interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  data?: {
    projectId?: string;
    taskId?: string;
    messageId?: string;
  };
}

// Socket notification interface - what comes from socket events
interface SocketNotification {
  _id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead?: boolean;
  createdAt?: string;
  actionUrl?: string;
  data?: {
    projectId?: string;
    taskId?: string;
    messageId?: string;
  };
}

// Web Push Notification service
class WebPushService {
  private vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  private subscription: PushSubscription | null = null;

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return false;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      // Subscribe to push notifications only if VAPID key is available
      if (this.vapidPublicKey) {
        this.subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });

        // Send subscription to server
        await this.sendSubscriptionToServer(this.subscription);
      }
      
      return true;

    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        }),
      });
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  }

  async unsubscribe(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
      
      // Remove subscription from server
      try {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error removing subscription from server:', error);
      }
    }
  }
}

// Notification Bell Component
export function NotificationBell() {
  const { data: session } = useSession();
  const socket = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Transform socket notification to app notification
  const transformSocketNotification = useCallback((socketNotif: SocketNotification): AppNotification => {
    return {
      _id: socketNotif._id || `temp-${Date.now()}-${Math.random()}`,
      title: socketNotif.title,
      message: socketNotif.message,
      type: socketNotif.type,
      isRead: socketNotif.isRead || false,
      createdAt: socketNotif.createdAt || new Date().toISOString(),
      actionUrl: socketNotif.actionUrl,
      data: socketNotif.data
    };
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications?limit=20');
      const data = await response.json();

      if (data.success) {
        // Ensure we have proper AppNotification objects
        const transformedNotifications: AppNotification[] = (data.data.notifications || []).map((notif: Record<string, unknown>) => ({
          _id: notif._id || `api-${Date.now()}-${Math.random()}`,
          title: notif.title || 'Notification',
          message: notif.message || '',
          type: notif.type || 'info',
          isRead: Boolean(notif.isRead),
          createdAt: notif.createdAt || new Date().toISOString(),
          actionUrl: notif.actionUrl,
          data: notif.data || {}
        }));

        setNotifications(transformedNotifications);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });

      setNotifications(prev => 
        prev.map(n => 
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PUT'
      });

      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Listen for new notifications via socket
  useEffect(() => {
    if (!socket.socket) return;

    const unsubscribe = socket.onNewNotification((socketNotification: SocketNotification) => {
      const appNotification = transformSocketNotification(socketNotification);
      
      setNotifications(prev => {
        // Avoid duplicates and limit to 20 notifications
        const filtered = prev.filter(n => n._id !== appNotification._id);
        return [appNotification, ...filtered].slice(0, 20);
      });
      
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification
      showToastNotification(appNotification);
    });

    return unsubscribe;
  }, [socket, transformSocketNotification]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const showToastNotification = (notification: AppNotification) => {
    const toastProps = {
      position: 'top-right' as const,
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    switch (notification.type) {
      case 'success':
        toast.success(notification.message, toastProps);
        break;
      case 'warning':
        toast.warning(notification.message, toastProps);
        break;
      case 'error':
        toast.error(notification.message, toastProps);
        break;
      default:
        toast.info(notification.message, toastProps);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-80 p-0">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Notifications
                </CardTitle>
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
              <ScrollArea className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-gray-500">
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          if (!notification.isRead) {
                            markAsRead(notification._id);
                          }
                          if (notification.actionUrl) {
                            window.location.href = notification.actionUrl;
                          }
                          setIsOpen(false);
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2" />
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            
                            <p className="text-xs text-gray-400 mt-2">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// Main Notification System Component
export default function NotificationSystem() {
  const { data: session } = useSession();
  const [webPushService] = useState(() => new WebPushService());
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  // Initialize web push notifications
  useEffect(() => {
    if (session?.user?.id) {
      webPushService.initialize().then(setIsPushEnabled);
    }

    return () => {
      webPushService.unsubscribe();
    };
  }, [session?.user?.id, webPushService]);

  return (
    <>
      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastStyle={{
          fontSize: '14px',
        }}
      />

      {/* Push Notification Status Debug (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <Badge variant={isPushEnabled ? 'default' : 'secondary'} className="text-xs">
            Push: {isPushEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      )}
    </>
  );
}