// src/types/socket.ts
// Shared types for Socket.IO events and data structures

export interface MessageSender {
  _id: string;
  name: string;
  avatar?: string;
}

export interface MessageRecipient {
  _id: string;
  name: string;
}

export interface MessageAttachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface Message {
  _id: string;
  projectId: string;
  sender: MessageSender;
  recipient?: MessageRecipient;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments: MessageAttachment[];
  isRead: boolean;
  createdAt: string;
}

export interface TaskData {
  _id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    _id: string;
    name: string;
  };
  dueDate?: string;
  updatedAt: string;
}

export interface ProjectData {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  updatedAt: string;
}

export interface NotificationSender {
  _id: string;
  name: string;
  avatar?: string;
}

export interface NotificationData {
  projectId?: string;
  taskId?: string;
  messageId?: string;
  fileId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
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

export interface TypingEventData {
  userId: string;
  projectId: string;
}

export interface UserStatusData {
  userId: string;
}

export interface UserProjectData {
  userId: string;
  projectId: string;
}

export interface SendNotificationPayload {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  data?: NotificationData;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'info' | 'success' | 'warning' | 'error';
}

// Additional utility types for better type safety
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationCategory = 'info' | 'success' | 'warning' | 'error';