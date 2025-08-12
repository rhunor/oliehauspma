// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { Notification, SendNotificationPayload } from '@/types/socket';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?unreadOnly=true&limit=1');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(async (notificationData: SendNotificationPayload) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Emit via socket for real-time delivery
        if (socket) {
          socket.emit('send_notification', {
            recipientId: notificationData.recipientId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data
          });
        }
        
        return result.data;
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }, [socket]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      });

      if (response.ok) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        if (socket) {
          socket.emit('mark_notification_read', notificationId);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [socket]);

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      socket.on('notification_received', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      return () => {
        socket.off('notification_received');
      };
    }
  }, [socket]);

  // Fetch initial unread count
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    sendNotification,
    markAsRead,
    refetchUnreadCount: fetchUnreadCount
  };
};