// src/contexts/SocketContext.tsx - FIXED: Extended Message interface to include isRead property
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

// Import socket utilities
const getSocketUrl = (): string => {
  // Check if we have a configured socket URL
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // If running in browser, dynamically determine socket URL
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    // Use the same host as the current page but on port 3001
    return `http://${currentHost}:3001`;
  }

  // Fallback for server-side
  return 'http://localhost:3001';
};

const shouldEnableSocket = (): boolean => {
  // Only enable socket if we have a configured URL or in development
  return !!(
    process.env.NEXT_PUBLIC_SOCKET_URL || 
    process.env.NODE_ENV === 'development'
  );
};

// FIXED: Extended Message interface to include isRead property for compatibility
interface Message {
  messageId: string;
  content: string;
  senderId: string;
  recipientId?: string;
  projectId?: string;
  timestamp: string;
  type?: 'text' | 'file' | 'system';
  isRead: boolean; // ADDED: This property to match SocketMessage interface
  senderName?: string; // ADDED: Optional sender name for compatibility
  senderAvatar?: string; // ADDED: Optional sender avatar for compatibility
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>; // ADDED: Optional attachments for compatibility
}

interface Notification {
  notificationId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  recipientId: string;
  projectId?: string;
  timestamp: string;
  actionUrl?: string;
}

interface UserStatus {
  userId: string;
  status: 'online' | 'offline';
  lastSeen: Date;
}

interface TypingUser {
  userId: string;
  projectId: string;
  isTyping: boolean;
}

// FIXED: Define specific types for project and task updates
interface ProjectUpdate {
  projectId: string;
  title?: string;
  status?: string;
  progress?: number;
  [key: string]: unknown;
}

interface TaskUpdate {
  taskId: string;
  projectId: string;
  title?: string;
  status?: string;
  assignee?: string;
  [key: string]: unknown;
}

interface FileUpload {
  fileId: string;
  projectId: string;
  filename: string;
  url: string;
  uploadedBy: string;
  [key: string]: unknown;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeUsers: UserStatus[];
  typingUsers: TypingUser[];
  
  // Connection control
  connect: () => void;
  disconnect: () => void;
  
  // Message functions
  sendMessage: (data: Omit<Message, 'messageId' | 'senderId' | 'timestamp' | 'isRead'>) => void;
  
  // Notification functions
  sendNotification: (data: Omit<Notification, 'notificationId' | 'timestamp'>) => void;
  
  // Project functions
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  
  // Typing functions
  startTyping: (projectId: string) => void;
  stopTyping: (projectId: string) => void;
  
  // Project update functions - FIXED: Use proper types instead of any
  broadcastProjectUpdate: (projectId: string, update: Omit<ProjectUpdate, 'projectId'>) => void;
  broadcastTaskUpdate: (projectId: string, task: Omit<TaskUpdate, 'projectId'>) => void;
  broadcastFileUpload: (projectId: string, file: Omit<FileUpload, 'projectId'>) => void;
  
  // Event listeners - FIXED: Use properly extended Message interface
  onNewMessage: (callback: (message: Message) => void) => () => void;
  onNewNotification: (callback: (notification: Notification) => void) => () => void;
  onUserStatusChange: (callback: (status: UserStatus) => void) => () => void;
  onUserTyping: (callback: (typing: TypingUser) => void) => () => void;
  onProjectUpdate: (callback: (update: ProjectUpdate) => void) => () => void;
  onTaskUpdate: (callback: (task: TaskUpdate) => void) => () => void;
  onFileUpload: (callback: (file: FileUpload) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Create a safe hook that doesn't throw an error
export const useSocketSafe = () => {
  const context = useContext(SocketContext);
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserStatus[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Manual connect function
  const connect = useCallback(() => {
    if (status === 'loading' || !session?.user?.id || socket) {
      console.log('Cannot connect: session loading, no user, or already connected');
      return;
    }

    // Get dynamic socket URL
    const socketUrl = getSocketUrl();
    
    // Skip connection if socket should not be enabled
    if (!shouldEnableSocket()) {
      console.log('Socket disabled in configuration');
      return;
    }
    
    console.log('Manually connecting to socket:', socketUrl);

    try {
      const newSocket = io(socketUrl, {
        auth: {
          token: session.user.id,
          userId: session.user.id,
          userRole: session.user.role
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        forceNew: true
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('🔌 Connected to Socket.IO server');
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('🔌 Disconnected from Socket.IO server:', reason);
      });

      newSocket.on('connect_error', (error) => {
        console.warn('🔌 Socket connection error (non-critical):', error.message);
        setIsConnected(false);
      });

      // User status events
      newSocket.on('user_status_change', (status: UserStatus) => {
        setActiveUsers(prev => {
          const filtered = prev.filter(user => user.userId !== status.userId);
          return [...filtered, status];
        });
      });

      // Typing events
      newSocket.on('user_typing', (typing: TypingUser) => {
        setTypingUsers(prev => {
          const filtered = prev.filter(user => 
            !(user.userId === typing.userId && user.projectId === typing.projectId)
          );
          
          if (typing.isTyping) {
            return [...filtered, typing];
          }
          return filtered;
        });

        // Auto-clear typing after 3 seconds
        if (typing.isTyping) {
          setTimeout(() => {
            setTypingUsers(prev => 
              prev.filter(user => 
                !(user.userId === typing.userId && user.projectId === typing.projectId)
              )
            );
          }, 3000);
        }
      });

      setSocket(newSocket);
    } catch (error) {
      console.warn('Failed to create socket connection (non-critical):', error);
    }
  }, [session?.user?.id, session?.user?.role, status, socket]);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setActiveUsers([]);
      setTypingUsers([]);
      console.log('🔌 Manually disconnected from Socket.IO');
    }
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  // Message functions - FIXED: Updated to match new Message interface
  const sendMessage = useCallback((data: Omit<Message, 'messageId' | 'senderId' | 'timestamp' | 'isRead'>) => {
    if (!socket?.connected) {
      console.warn('Socket not connected, cannot send message');
      return;
    }
    socket.emit('send_message', data);
  }, [socket]);

  // Notification functions
  const sendNotification = useCallback((data: Omit<Notification, 'notificationId' | 'timestamp'>) => {
    if (!socket?.connected) {
      console.warn('Socket not connected, cannot send notification');
      return;
    }
    socket.emit('send_notification', data);
  }, [socket]);

  // Project functions
  const joinProject = useCallback((projectId: string) => {
    if (!socket?.connected) {
      console.warn('Socket not connected, cannot join project');
      return;
    }
    socket.emit('join_project', projectId);
  }, [socket]);

  const leaveProject = useCallback((projectId: string) => {
    if (!socket?.connected) {
      console.warn('Socket not connected, cannot leave project');
      return;
    }
    socket.emit('leave_project', projectId);
  }, [socket]);

  // Typing functions
  const startTyping = useCallback((projectId: string) => {
    if (!socket?.connected) return;
    socket.emit('typing', { projectId });
  }, [socket]);

  const stopTyping = useCallback((projectId: string) => {
    if (!socket?.connected) return;
    socket.emit('stop_typing', { projectId });
  }, [socket]);

  // Broadcast functions - FIXED: Use proper types instead of any
  const broadcastProjectUpdate = useCallback((projectId: string, update: Omit<ProjectUpdate, 'projectId'>) => {
    if (!socket?.connected) return;
    socket.emit('project_update', { projectId, ...update });
  }, [socket]);

  const broadcastTaskUpdate = useCallback((projectId: string, task: Omit<TaskUpdate, 'projectId'>) => {
    if (!socket?.connected) return;
    socket.emit('task_update', { projectId, ...task });
  }, [socket]);

  const broadcastFileUpload = useCallback((projectId: string, file: Omit<FileUpload, 'projectId'>) => {
    if (!socket?.connected) return;
    socket.emit('file_uploaded', { projectId, ...file });
  }, [socket]);

  // Event listener functions - FIXED: Now properly compatible with extended Message interface
  const onNewMessage = useCallback((callback: (message: Message) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_message', callback);
    return () => socket.off('new_message', callback);
  }, [socket]);

  const onNewNotification = useCallback((callback: (notification: Notification) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_notification', callback);
    return () => socket.off('new_notification', callback);
  }, [socket]);

  const onUserStatusChange = useCallback((callback: (status: UserStatus) => void) => {
    if (!socket) return () => {};
    
    socket.on('user_status_change', callback);
    return () => socket.off('user_status_change', callback);
  }, [socket]);

  const onUserTyping = useCallback((callback: (typing: TypingUser) => void) => {
    if (!socket) return () => {};
    
    socket.on('user_typing', callback);
    return () => socket.off('user_typing', callback);
  }, [socket]);

  const onProjectUpdate = useCallback((callback: (update: ProjectUpdate) => void) => {
    if (!socket) return () => {};
    
    socket.on('project_updated', callback);
    return () => socket.off('project_updated', callback);
  }, [socket]);

  const onTaskUpdate = useCallback((callback: (task: TaskUpdate) => void) => {
    if (!socket) return () => {};
    
    socket.on('task_updated', callback);
    return () => socket.off('task_updated', callback);
  }, [socket]);

  const onFileUpload = useCallback((callback: (file: FileUpload) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_file', callback);
    return () => socket.off('new_file', callback);
  }, [socket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    activeUsers,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendNotification,
    joinProject,
    leaveProject,
    startTyping,
    stopTyping,
    broadcastProjectUpdate,
    broadcastTaskUpdate,
    broadcastFileUpload,
    onNewMessage,
    onNewNotification,
    onUserStatusChange,
    onUserTyping,
    onProjectUpdate,
    onTaskUpdate,
    onFileUpload
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};