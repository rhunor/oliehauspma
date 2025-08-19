// src/types/socket.ts - Updated Socket Types (keeping your current structure)
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
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

// Updated Message interface to match ChatContainer expectations
export interface Message {
  _id: string;
  projectId: string;
  senderId: string; // This was missing - added to fix the error
  recipientId?: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments: MessageAttachment[];
  sender: MessageSender;
  recipient?: MessageRecipient;
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

// Socket event interfaces - FIXED: Added missing message_sent event
export interface ServerToClientEvents {
  message_received: (message: Message) => void;
  message_sent: (message: Message) => void; // Added this missing event
  user_typing_start: (data: TypingEventData) => void;
  user_typing_stop: (data: TypingEventData) => void;
  notification_received: (notification: Notification) => void;
  task_updated: (data: TaskData) => void;
  project_updated: (data: ProjectData) => void;
  user_online: (data: UserStatusData) => void;
  user_offline: (data: UserStatusData) => void;
  user_joined_project: (data: UserProjectData) => void;
  user_left_project: (data: UserProjectData) => void;
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
    recipientId?: string; // Fixed: Added recipientId to match the socket interface
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