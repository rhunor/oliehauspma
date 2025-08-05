import { ObjectId } from 'mongodb';

// User Types
export type UserRole = 'super_admin' | 'project_manager' | 'client';

export interface User {
  _id: ObjectId;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  phone?: string;
}

// Project Types
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

export interface Project {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId | User;
  manager: ObjectId | User;
  status: ProjectStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: Date;
  endDate: Date;
  budget?: number;
  progress: number; // 0-100
  tasks: Task[];
  files: ProjectFile[];
  milestones: Milestone[];
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  title: string;
  description: string;
  clientId: string;
  managerId: string;
  startDate: Date;
  endDate: Date;
  budget?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  notes?: string;
}

// Task Types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignee: ObjectId | User;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: ObjectId[]; // Other task IDs this task depends on
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdBy: ObjectId | User;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CreateTaskData {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  deadline: Date;
  priority?: TaskPriority;
  estimatedHours?: number;
  dependencies?: string[];
}

export interface TaskAttachment {
  _id: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedBy: ObjectId | User;
  uploadedAt: Date;
}

export interface TaskComment {
  _id: ObjectId;
  content: string;
  author: ObjectId | User;
  createdAt: Date;
  updatedAt: Date;
}

// Milestone Types
export interface Milestone {
  _id: ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  isCompleted: boolean;
  completedAt?: Date;
  tasks: ObjectId[]; // Task IDs associated with this milestone
  createdAt: Date;
  updatedAt: Date;
}

// File Types
export interface ProjectFile {
  _id: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: 'document' | 'image' | 'video' | 'other';
  uploadedBy: ObjectId | User;
  projectId: ObjectId;
  isPublic: boolean; // Whether client can view this file
  uploadedAt: Date;
}

export interface FileUploadData {
  file: File;
  projectId: string;
  category?: 'document' | 'image' | 'video' | 'other';
  isPublic?: boolean;
}

// Chat Types
export interface ChatMessage {
  _id: ObjectId;
  content: string;
  sender: ObjectId | User;
  recipient: ObjectId | User;
  projectId: ObjectId;
  messageType: 'text' | 'file' | 'image' | 'system';
  fileUrl?: string;
  fileName?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatMessageData {
  content: string;
  recipientId: string;
  projectId: string;
  messageType?: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
}

// Notification Types
export type NotificationType = 
  | 'task_assigned' 
  | 'task_completed' 
  | 'project_updated' 
  | 'milestone_reached' 
  | 'deadline_approaching' 
  | 'message_received'
  | 'file_uploaded'
  | 'user_mentioned';

export interface Notification {
  _id: ObjectId;
  recipient: ObjectId | User;
  sender?: ObjectId | User;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    projectId?: ObjectId;
    taskId?: ObjectId;
    messageId?: ObjectId;
    fileId?: ObjectId;
  };
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface CreateNotificationData {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    projectId?: string;
    taskId?: string;
    messageId?: string;
    fileId?: string;
  };
}

// Dashboard Analytics Types
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalUsers: number;
  activeUsers: number;
}

export interface ProjectAnalytics {
  projectId: ObjectId;
  completionPercentage: number;
  tasksCompleted: number;
  totalTasks: number;
  daysRemaining: number;
  isOnTrack: boolean;
  milestoneProgress: {
    completed: number;
    total: number;
  };
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  phone?: string;
}

export interface ProjectFormData {
  title: string;
  description: string;
  clientId: string;
  managerId: string;
  startDate: string;
  endDate: string;
  budget?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  notes?: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  assigneeId: string;
  deadline: string;
  priority: TaskPriority;
  estimatedHours?: number;
  dependencies: string[];
}

export interface ProfileUpdateData {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Socket.IO Event Types
export interface ServerToClientEvents {
  message_received: (message: ChatMessage) => void;
  task_updated: (task: Task) => void;
  project_updated: (project: Project) => void;
  notification_received: (notification: Notification) => void;
  user_online: (userId: string) => void;
  user_offline: (userId: string) => void;
  typing_start: (data: { userId: string; projectId: string }) => void;
  typing_stop: (data: { userId: string; projectId: string }) => void;
}

export interface ClientToServerEvents {
  join_project: (projectId: string) => void;
  leave_project: (projectId: string) => void;
  send_message: (data: CreateChatMessageData) => void;
  typing_start: (projectId: string) => void;
  typing_stop: (projectId: string) => void;
  mark_notification_read: (notificationId: string) => void;
}

// Chatbot Types
export interface ChatbotMessage {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  projectContext?: {
    projectId: string;
    projectName: string;
  };
}

export interface ChatbotContextData {
  projectId: string;
  userId: string;
  userRole: UserRole;
  projectDetails: {
    title: string;
    status: ProjectStatus;
    progress: number;
    tasks: {
      total: number;
      completed: number;
      pending: number;
    };
    milestones: {
      total: number;
      completed: number;
    };
  };
}

// Settings Types
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    taskAssignments: boolean;
    projectUpdates: boolean;
    deadlineReminders: boolean;
    chatMessages: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };
}

// Export utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Database connection types
export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: {
    maxPoolSize?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
    family?: number;
  };
}