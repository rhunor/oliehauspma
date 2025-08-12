// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';
import type {
  Message,
  TaskData,
  ProjectData,
  Notification,
  TypingEventData,
  UserStatusData,
  UserProjectData,
  NotificationData
} from '@/types/socket';

export interface ServerToClientEvents {
  message_received: (message: Message) => void;
  message_sent: (message: Message) => void;
  message_error: (error: { error: string }) => void;
  task_updated: (task: TaskData) => void;
  project_updated: (project: ProjectData) => void;
  notification_received: (notification: Notification) => void;
  user_online: (data: UserStatusData) => void;
  user_offline: (data: UserStatusData) => void;
  user_joined_project: (data: UserProjectData) => void;
  user_left_project: (data: UserProjectData) => void;
  user_typing_start: (data: TypingEventData) => void;
  user_typing_stop: (data: TypingEventData) => void;
}

export interface ClientToServerEvents {
  authenticate: (data: { userId: string; userRole: string }) => void;
  join_project: (projectId: string) => void;
  leave_project: (projectId: string) => void;
  send_message: (data: {
    projectId: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'audio' | 'video';
    recipient?: string;
  }) => void;
  typing_start: (projectId: string) => void;
  typing_stop: (projectId: string) => void;
  send_notification: (data: {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    data?: NotificationData;
  }) => void;
  mark_notification_read: (notificationId: string) => void;
  task_updated: (data: { 
    projectId: string; 
    taskData: Partial<TaskData> & { _id: string };
  }) => void;
  project_updated: (data: { 
    projectId: string; 
    projectData: Partial<ProjectData> & { _id: string };
  }) => void;
}

class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string, userRole: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.reconnectAttempts = 0;
      this.socket?.emit('authenticate', { userId, userRole });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.IO server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket?.disconnect();
      }
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketManager = new SocketManager();