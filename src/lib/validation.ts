// src/lib/validation.ts - FIXED VERSION
import { z } from 'zod';

// Helper function for ObjectId validation
export function validateObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// User validation schemas
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .transform(email => email.toLowerCase()),
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
    .regex(/^[a-zA-Z\s.-]+$/, 'Name can only contain letters, spaces, dots, and hyphens')
    .transform(name => name.trim()),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .transform(email => email.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role: z.enum(['super_admin', 'project_manager', 'client'] as const),
  phone: z
    .string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val)
    .refine(val => !val || /^(\+234|0)[789]\d{9}$/.test(val.replace(/\s/g, '')), {
      message: 'Please enter a valid Nigerian phone number',
    }),
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
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  role: z.enum(['super_admin', 'project_manager', 'client'] as const),
  phone: z
    .string()
    .optional()
    .refine(val => !val || val.trim() === '' || /^(\+234|0)[789]\d{9}$/.test(val.replace(/\s/g, '')), {
      message: 'Please enter a valid Nigerian phone number',
    }),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .transform(name => name.trim())
    .optional(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform(email => email.toLowerCase())
    .optional(),
  phone: z
    .string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val)
    .refine(val => !val || /^(\+234|0)[789]\d{9}$/.test(val.replace(/\s/g, '')), {
      message: 'Please enter a valid Nigerian phone number',
    }),
  avatar: z.string().url('Please enter a valid URL').optional(),
  role: z.enum(['super_admin', 'project_manager', 'client'] as const).optional(),
  isActive: z.boolean().optional(),
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

// FIXED PROJECT SCHEMA - Removed complex transformations that cause type issues
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
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  budget: z.number().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  tags: z.array(z.string()),
  notes: z.string().optional(),
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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
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
  deadline: z.string().min(1, 'Deadline is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  estimatedHours: z.number().optional(),
  dependencies: z.array(z.string()),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked'] as const).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).optional(),
  deadline: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
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
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  message: z.string().min(1, 'Message is required').max(500, 'Message must be less than 500 characters'),
  data: z.object({
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    messageId: z.string().optional(),
    fileId: z.string().optional(),
  }).optional(),
});

// Export all the inferred types
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
export type CreateNotificationData = z.infer<typeof createNotificationSchema>;

// Utility validation functions
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
  return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate;
}

// Transform helpers for your components
export function transformTagsToArray(tags: string): string[] {
  if (!tags || tags.trim() === '') return [];
  return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
}

export function transformArrayToTags(tags: string[]): string {
  return tags.join(', ');
}

export function transformBudget(value: string | number | undefined): number | undefined {
  if (value === '' || value === undefined || value === null) return undefined;
  return typeof value === 'string' ? Number(value) : value;
}

export function transformName(name: string): string {
  return name.trim();
}

export function transformEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function transformPhone(phone: string | undefined): string | undefined {
  if (!phone || phone.trim() === '') return undefined;
  return phone.trim();
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