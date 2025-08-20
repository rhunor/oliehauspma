// src/types/global.ts - Fixed Type Definitions Without Export Conflicts
import { ObjectId } from 'mongodb';

// =============================================================================
// USER TYPES
// =============================================================================
export type UserRole = 'super_admin' | 'project_manager' | 'client';

export interface User {
  _id: ObjectId | string;
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

// =============================================================================
// PROJECT TYPES
// =============================================================================
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  _id: ObjectId | string;
  title: string;
  description: string;
  client: ObjectId | string | User;
  manager: ObjectId | string | User;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: Date;
  endDate: Date;
  budget?: number;
  progress: number; // 0-100
  tasks?: Task[];
  files?: ProjectFile[];
  milestones?: Milestone[];
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// TASK TYPES
// =============================================================================
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: ObjectId | string;
  title: string;
  description: string;
  projectId: ObjectId | string;
  assignee: ObjectId | string | User;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: (ObjectId | string)[]; // Other task IDs this task depends on
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdBy: ObjectId | string | User;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TaskComment {
  _id: ObjectId | string;
  content: string;
  authorId: ObjectId | string;
  author?: User;
  createdAt: Date;
  updatedAt?: Date;
  isInternal: boolean;
}

export interface TaskAttachment {
  _id: ObjectId | string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedBy: ObjectId | string | User;
  uploadedAt: Date;
}

// =============================================================================
// MESSAGE/CHAT TYPES
// =============================================================================
export type MessageType = 'text' | 'file' | 'system' | 'image' | 'audio' | 'video';

export interface ChatMessage {
  messageId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  projectId?: string;
  timestamp: string;
  type: MessageType;
  isRead: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface SocketMessage {
  messageId: string;
  content: string;
  senderId: string;
  recipientId?: string;
  projectId?: string;
  timestamp: string;
  type: MessageType;
  isRead: boolean;
  senderName?: string;
  senderAvatar?: string;
  attachments?: MessageAttachment[];
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  data?: Record<string, unknown>; // FIXED: Use Record<string, unknown> instead of any
}

export interface SocketNotification {
  _id?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead?: boolean;
  createdAt?: string;
  actionUrl?: string;
  data?: Record<string, unknown>; // FIXED: Use Record<string, unknown> instead of any
}

// =============================================================================
// FILE TYPES
// =============================================================================
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface ProjectFile {
  _id: ObjectId | string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: FileCategory;
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: ObjectId | string | User;
  project: ObjectId | string | Project;
  createdAt: Date;
  downloadCount: number;
}

// =============================================================================
// MILESTONE TYPES
// =============================================================================
export interface Milestone {
  _id: ObjectId | string;
  title: string;
  description: string;
  dueDate: Date;
  isCompleted: boolean;
  completedAt?: Date;
  projectId: ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SOCKET EVENT TYPES
// =============================================================================
export interface TypingData {
  userId: string;
  projectId?: string;
  isTyping: boolean;
}

export interface JoinRoomData {
  projectId: string;
  userId: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================
export interface ApiResponse<T = unknown> { // FIXED: Use unknown instead of any as default
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> { // FIXED: Use unknown instead of any as default
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// =============================================================================
// FORM DATA TYPES
// =============================================================================
export interface CreateProjectData {
  title: string;
  description: string;
  clientId: string;
  managerId: string;
  startDate: Date;
  endDate: Date;
  budget?: number;
  priority?: ProjectPriority;
  tags?: string[];
  notes?: string;
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

export interface UpdateTaskData {
  title?: string;
  description?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: Date;
  estimatedHours?: number;
  actualHours?: number;
  dependencies?: string[];
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================
export interface RealTimeChatProps {
  projectId?: string;
  participantId?: string;
  className?: string;
  height?: string;
}

export interface NotificationBellProps {
  className?: string;
}

export interface FileUploadProps {
  projectId: string;
  onUploadComplete?: (file: ProjectFile) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

// =============================================================================
// DATABASE DOCUMENT TYPES (for MongoDB operations)
// =============================================================================
export interface UserDocument {
  _id: ObjectId;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  passwordHash: string;
  lastLogin?: Date;
  emailNotifications: boolean;
  pushNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId;
  manager: ObjectId;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: Date;
  endDate: Date;
  budget?: number;
  progress: number;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDocument {
  _id: ObjectId;
  title: string;
  description: string;
  projectId: ObjectId;
  assignee: ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: ObjectId[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface MessageDocument {
  _id: ObjectId;
  projectId?: ObjectId;
  senderId: ObjectId;
  recipientId: ObjectId;
  content: string;
  messageType: MessageType;
  attachments: MessageAttachment[];
  isRead: boolean;
  readAt?: Date;
  editedAt?: Date;
  replyTo?: ObjectId;
  reactions: MessageReaction[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReaction {
  userId: ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface NotificationDocument {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  data?: Record<string, unknown>; // FIXED: Use Record<string, unknown> instead of any
  createdAt: Date;
  updatedAt: Date;
}

export interface FileDocument {
  _id: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: FileCategory;
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: ObjectId;
  projectId: ObjectId;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar?: string;
  };
  expires: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// =============================================================================
// SEARCH AND FILTER TYPES
// =============================================================================
export interface SearchFilters {
  query?: string;
  status?: string[];
  priority?: string[];
  assignee?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: SortOptions;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalUsers: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  _id: string;
  type: 'project_created' | 'task_completed' | 'file_uploaded' | 'message_sent' | 'user_joined';
  description: string;
  user: User;
  timestamp: Date;
  projectId?: string;
  taskId?: string;
}

// =============================================================================
// CALENDAR TYPES
// =============================================================================
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'task' | 'milestone' | 'meeting' | 'deadline';
  projectId?: string;
  taskId?: string;
  description?: string;
  color?: string;
}

// =============================================================================
// REPORT TYPES
// =============================================================================
export interface ProjectReport {
  projectId: string;
  projectTitle: string;
  status: ProjectStatus;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksOverdue: number;
  budget?: number;
  actualCost?: number;
  timeSpent: number;
  estimatedTime: number;
  teamMembers: User[];
  milestones: Milestone[];
  recentActivity: ActivityItem[];
}

export interface TimeTrackingEntry {
  _id: ObjectId | string;
  taskId: ObjectId | string;
  userId: ObjectId | string;
  description: string;
  hours: number;
  date: Date;
  createdAt: Date;
}

// =============================================================================
// WEBSOCKET EVENT TYPES
// =============================================================================
export interface ServerToClientEvents {
  new_message: (message: SocketMessage) => void;
  new_notification: (notification: SocketNotification) => void;
  user_typing: (data: TypingData) => void;
  user_joined: (data: { userId: string; projectId: string }) => void;
  user_left: (data: { userId: string; projectId: string }) => void;
  project_updated: (project: Project) => void;
  task_updated: (task: Task) => void;
  user_online: (userId: string) => void;
  user_offline: (userId: string) => void;
}

export interface ClientToServerEvents {
  join_project: (projectId: string) => void;
  leave_project: (projectId: string) => void;
  send_message: (data: {
    content: string;
    projectId?: string;
    recipientId?: string;
    type: MessageType;
  }) => void;
  start_typing: (projectId: string) => void;
  stop_typing: (projectId: string) => void;
  mark_online: () => void;
  mark_offline: () => void;
}

// =============================================================================
// EMAIL TYPES
// =============================================================================
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface NotificationEmailData {
  recipientId: string;
  type: 'project_update' | 'task_assigned' | 'task_completed' | 'milestone_reached' | 'deadline_reminder' | 'message_received' | 'file_uploaded' | 'welcome' | 'general';
  projectId?: string;
  taskId?: string;
  data?: Record<string, unknown>; // FIXED: Use Record<string, unknown> instead of any
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================
export interface AppConfig {
  database: {
    url: string;
    name: string;
  };
  auth: {
    secret: string;
    providers: string[];
  };
  email: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
  storage: {
    provider: 'local' | 's3' | 'cloudinary';
    config: Record<string, unknown>; // FIXED: Use Record<string, unknown> instead of any
  };
  features: {
    realTimeChat: boolean;
    pushNotifications: boolean;
    emailNotifications: boolean;
    fileUpload: boolean;
    timeTracking: boolean;
  };
}

// =============================================================================
// ERROR TYPES
// =============================================================================
export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown; // FIXED: Use unknown instead of any
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown; // FIXED: Use unknown instead of any
}

// =============================================================================
// UTILITY TYPES
// =============================================================================
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Transform MongoDB ObjectId to string for client-side usage
export type ClientSafe<T> = {
  [K in keyof T]: T[K] extends ObjectId 
    ? string 
    : T[K] extends ObjectId | undefined 
    ? string | undefined
    : T[K] extends (ObjectId | string)[]
    ? string[]
    : T[K] extends Date
    ? string
    : T[K] extends Date | undefined
    ? string | undefined
    : T[K];
};

// Common database filter types
export type MongoFilter<T> = {
  [K in keyof T]?: T[K] | { $in: T[K][] } | { $ne: T[K] } | { $exists: boolean };
} & {
  $or?: MongoFilter<T>[];
  $and?: MongoFilter<T>[];
};

// =============================================================================
// COMPONENT STATE TYPES
// =============================================================================
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface AsyncState<T> extends LoadingState {
  data?: T;
}

export interface FormState<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================
// FIXED: Use proper Socket type instead of any
export interface UseSocketReturn {
  socket: unknown; // Use unknown for Socket.IO instance
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  sendMessage: (data: Omit<SocketMessage, 'messageId' | 'senderId' | 'timestamp'>) => void;
  onNewMessage: (callback: (message: SocketMessage) => void) => () => void;
  onNewNotification: (callback: (notification: SocketNotification) => void) => () => void;
  onUserTyping: (callback: (data: TypingData) => void) => () => void;
  startTyping: (projectId: string) => void;
  stopTyping: (projectId: string) => void;
}

export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================
// FIXED: Remove empty interface that extends another
export interface SocketContextValue {
  socket: unknown;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  sendMessage: (data: Omit<SocketMessage, 'messageId' | 'senderId' | 'timestamp'>) => void;
  onNewMessage: (callback: (message: SocketMessage) => void) => () => void;
  onNewNotification: (callback: (notification: SocketNotification) => void) => () => void;
  onUserTyping: (callback: (data: TypingData) => void) => () => void;
  startTyping: (projectId: string) => void;
  stopTyping: (projectId: string) => void;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
}

export interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// =============================================================================
// ROUTE PARAMETER TYPES
// =============================================================================
export interface ProjectPageParams {
  id: string;
}

export interface TaskPageParams {
  id: string;
}

export interface UserPageParams {
  id: string;
}