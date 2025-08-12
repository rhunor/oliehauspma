// src/components/layout/NotificationBell.tsx - REAL DATABASE DRIVEN
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import NotificationPanel from '@/components/notifications/NotificationPanel';

// Define interface for API response
interface NotificationApiResponse {
  success: boolean;
  unreadCount: number;
  data?: unknown[];
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch real unread count from database
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch('/api/notifications?unreadOnly=true&limit=1');
        if (response.ok) {
          const data: NotificationApiResponse = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  if (!session?.user) {
    return null;
  }

  return (
    <>
      <Button
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

      <NotificationPanel 
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
        onNotificationRead={() => setUnreadCount(prev => Math.max(0, prev - 1))}
      />
    </>
  );
}