import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UserRole, TaskStatus, TaskPriority, ProjectStatus, NotificationType } from '@/types';

// User validation schemas
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role: z.enum(['super_admin', 'project_manager', 'client'] as const),
  phone: z
    .string()
    .regex(/^(\+234|0)[789]\d{9}$/, 'Please enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  role: z.enum(['super_admin', 'project_manager', 'client'] as const),
  phone: z
    .string()
    .regex(/^(\+234|0)[789]\d{9}$/, 'Please enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .optional(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .optional(),
  phone: z
    .string()
    .regex(/^(\+234|0)[789]\d{9}$/, 'Please enter a valid Nigerian phone number')
    .optional()
    .or(z.literal('')),
  avatar: z.string().url('Please enter a valid URL').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

// Project validation schemas
export const createProjectSchema = z.object({
  title: z
    .string()
    .min(1, 'Project title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .min(1, 'Project description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  clientId: z.string().min(1, 'Client is required'),
  managerId: z.string().min(1, 'Project manager is required'),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid start date'),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid end date'),
  budget: z
    .number()
    .min(0, 'Budget must be a positive number')
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).default('medium'),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateProjectSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'] as const).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).optional(),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid start date').optional(),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid end date').optional(),
  budget: z.number().min(0, 'Budget must be a positive number').optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

// Task validation schemas
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .min(1, 'Task description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),
  projectId: z.string().min(1, 'Project is required'),
  assigneeId: z.string().min(1, 'Assignee is required'),
  deadline: z.string().refine((date) => {
    const parsed = new Date(date);
    const now = new Date();
    return !isNaN(parsed.getTime()) && parsed > now;
  }, 'Deadline must be a valid future date'),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).default('medium'),
  estimatedHours: z
    .number()
    .min(0.5, 'Estimated hours must be at least 0.5')
    .max(1000, 'Estimated hours must be less than 1000')
    .optional(),
  dependencies: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked'] as const).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).optional(),
  deadline: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid deadline').optional(),
  estimatedHours: z
    .number()
    .min(0.5, 'Estimated hours must be at least 0.5')
    .max(1000, 'Estimated hours must be less than 1000')
    .optional(),
  actualHours: z
    .number()
    .min(0, 'Actual hours must be a positive number')
    .max(1000, 'Actual hours must be less than 1000')
    .optional(),
  dependencies: z.array(z.string()).optional(),
});

export const taskCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment is required')
    .min(3, 'Comment must be at least 3 characters')
    .max(500, 'Comment must be less than 500 characters'),
  taskId: z.string().min(1, 'Task ID is required'),
});

// Chat validation schemas
export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be less than 1000 characters'),
  recipientId: z.string().min(1, 'Recipient is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  messageType: z.enum(['text', 'file', 'image', 'system'] as const).default('text'),
  fileUrl: z.string().url('Please enter a valid file URL').optional(),
  fileName: z.string().max(255, 'File name must be less than 255 characters').optional(),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  category: z.enum(['document', 'image', 'video', 'other'] as const).default('other'),
  isPublic: z.boolean().default(true),
});

export const fileValidation = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'), // 10MB limit
  type: z.string().refine((type) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];
    return allowedTypes.includes(type);
  }, 'File type not supported'),
});

// Notification validation schemas
export const createNotificationSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  senderId: z.string().optional(),
  type: z.enum([
    'task_assigned',
    'task_completed',
    'project_updated',
    'milestone_reached',
    'deadline_approaching',
    'message_received',
    'file_uploaded',
    'user_mentioned',
  ] as const),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(500, 'Message must be less than 500 characters'),
  data: z.object({
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    messageId: z.string().optional(),
    fileId: z.string().optional(),
  }).optional(),
});

// Search and pagination schemas
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
  filters: z.object({
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    assignee: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }).optional(),
});

export const paginationSchema = z.object({
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(10),
  sort: z.enum(['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title'] as const).default('createdAt'),
  order: z.enum(['asc', 'desc'] as const).default('desc'),
});

// Settings validation schemas
export const userSettingsSchema = z.object({
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    taskAssignments: z.boolean().default(true),
    projectUpdates: z.boolean().default(true),
    deadlineReminders: z.boolean().default(true),
    chatMessages: z.boolean().default(true),
  }).default({
    email: true,
    push: true,
    taskAssignments: true,
    projectUpdates: true,
    deadlineReminders: true,
    chatMessages: true,
  }),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system'] as const).default('light'),
    language: z.string().default('en'),
    timezone: z.string().default('Africa/Lagos'),
    dateFormat: z.string().default('MMM dd, yyyy'),
    timeFormat: z.enum(['12h', '24h'] as const).default('12h'),
  }).default({
    theme: 'light',
    language: 'en',
    timezone: 'Africa/Lagos',
    dateFormat: 'MMM dd, yyyy',
    timeFormat: '12h',
  }),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'private'] as const).default('public'),
    showOnlineStatus: z.boolean().default(true),
    allowDirectMessages: z.boolean().default(true),
  }).default({
    profileVisibility: 'public',
    showOnlineStatus: true,
    allowDirectMessages: true,
  }),
});

// Milestone validation schemas
export const createMilestoneSchema = z.object({
  title: z
    .string()
    .min(1, 'Milestone title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  dueDate: z.string().refine((date) => {
    const parsed = new Date(date);
    const now = new Date();
    return !isNaN(parsed.getTime()) && parsed > now;
  }, 'Due date must be a valid future date'),
  projectId: z.string().min(1, 'Project ID is required'),
  tasks: z.array(z.string()).default([]),
});

export const updateMilestoneSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  dueDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Please enter a valid due date').optional(),
  isCompleted: z.boolean().optional(),
  tasks: z.array(z.string()).optional(),
});

// Analytics validation schemas
export const analyticsQuerySchema = z.object({
  projectId: z.string().optional(),
  userId: z.string().optional(),
  dateRange: z.object({
    start: z.string().refine((date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }, 'Please enter a valid start date'),
    end: z.string().refine((date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }, 'Please enter a valid end date'),
  }).optional(),
  metrics: z.array(z.enum([
    'projects_completed',
    'tasks_completed',
    'user_activity',
    'project_progress',
    'deadline_performance',
  ] as const)).optional(),
});

// Chatbot validation schemas
export const chatbotQuerySchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(500, 'Message must be less than 500 characters'),
  projectId: z.string().min(1, 'Project ID is required'),
  context: z.object({
    previousMessages: z.array(z.object({
      content: z.string(),
      isBot: z.boolean(),
      timestamp: z.string(),
    })).max(10, 'Too many previous messages').optional(),
  }).optional(),
});

// Export utility functions for validation
export function validateObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateDateRange(start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate;
}

// Custom validation error formatter
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  
  errors.issues.forEach((error: z.ZodIssue) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });
  
  return formattedErrors;
}

// Safe parse with custom error handling
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: formatValidationErrors(result.error) };
  }
}

// Type exports for better TypeScript support
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type CreateProjectData = z.infer<typeof createProjectSchema>;
export type UpdateProjectData = z.infer<typeof updateProjectSchema>;
export type CreateTaskData = z.infer<typeof createTaskSchema>;
export type UpdateTaskData = z.infer<typeof updateTaskSchema>;
export type TaskCommentData = z.infer<typeof taskCommentSchema>;
export type ChatMessageData = z.infer<typeof chatMessageSchema>;
export type FileUploadData = z.infer<typeof fileUploadSchema>;
export type CreateNotificationData = z.infer<typeof createNotificationSchema>;
export type SearchData = z.infer<typeof searchSchema>;
export type PaginationData = z.infer<typeof paginationSchema>;
export type UserSettingsData = z.infer<typeof userSettingsSchema>;
export type CreateMilestoneData = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneData = z.infer<typeof updateMilestoneSchema>;
export type AnalyticsQueryData = z.infer<typeof analyticsQuerySchema>;
export type ChatbotQueryData = z.infer<typeof chatbotQuerySchema>;