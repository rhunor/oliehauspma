// src/types/activity.ts
// TypeScript interfaces for Activity/Task management
// NO 'any' types - all properly typed

import { Types } from 'mongoose';

// ============================================================================
// CORE ACTIVITY INTERFACES
// ============================================================================

export type ActivityStatus = 'to-do' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActivityCategory = 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';

// Activity Comment interface
export interface ActivityComment {
  _id?: string;
  author: {
    _id: string;
    name: string;
    role: string;
    email?: string;
  };
  content: string;
  attachments?: string[]; // S3 URLs
  createdAt: string;
  updatedAt?: string;
}

// MongoDB Document version (with ObjectId)
export interface ActivityCommentDocument {
  _id?: Types.ObjectId;
  author: Types.ObjectId;
  authorName: string;
  authorRole: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// Core Activity interface (for API responses)
export interface Activity {
  _id: string;
  title: string;
  description?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  category: ActivityCategory;
  assignedTo?: string[]; // User IDs
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  comments: ActivityComment[];
  images: string[]; // S3 URLs
  contractor?: string;
  supervisor?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  resources?: string[];
  dependencies?: string[]; // Activity IDs this depends on
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// MongoDB Document version (what's stored in database)
export interface ActivityDocument {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  category: ActivityCategory;
  assignedTo?: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  progress: number;
  comments: ActivityCommentDocument[];
  images: string[];
  contractor?: string;
  supervisor?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  resources?: string[];
  dependencies?: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE INTERFACES
// ============================================================================

// Request body for creating a new activity
export interface CreateActivityRequest {
  phaseId: string;
  title: string;
  description?: string;
  status?: ActivityStatus;
  priority?: ActivityPriority;
  category?: ActivityCategory;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  assignedTo?: string[];
  contractor?: string;
  supervisor?: string;
  estimatedDuration?: string;
  resources?: string[];
  dependencies?: string[];
}

// Request body for updating an activity
export interface UpdateActivityRequest {
  title?: string;
  description?: string;
  status?: ActivityStatus;
  priority?: ActivityPriority;
  category?: ActivityCategory;
  startDate?: string;
  endDate?: string;
  progress?: number;
  assignedTo?: string[];
  contractor?: string;
  supervisor?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  resources?: string[];
  dependencies?: string[];
}

// Request body for adding a comment
export interface AddCommentRequest {
  content: string;
  attachments?: string[];
}

// API Success Response
export interface ActivityApiResponse {
  success: true;
  data: Activity;
  message?: string;
}

// API Error Response
export interface ActivityApiError {
  success: false;
  error: string;
  details?: string;
}

// Combined API response type
export type ActivityApiResult = ActivityApiResponse | ActivityApiError;

// ============================================================================
// PHASE INTERFACES (containing activities)
// ============================================================================

export interface Phase {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: Activity[];
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PhaseDocument {
  _id?: Types.ObjectId;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: ActivityDocument[];
  dependencies?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ACCESS CONTROL INTERFACES
// ============================================================================

export interface ActivityPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComment: boolean;
  canUploadImages: boolean;
  canEditStatus: boolean;
  canEditDates: boolean;
  canEditAssignments: boolean;
}

// Role-based permission rules
export const getActivityPermissions = (userRole: string): ActivityPermissions => {
  switch (userRole) {
    case 'super_admin':
    case 'project_manager':
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canComment: true,
        canUploadImages: true,
        canEditStatus: true,
        canEditDates: true,
        canEditAssignments: true,
      };
    case 'client':
      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canComment: true,
        canUploadImages: true,
        canEditStatus: false,
        canEditDates: false,
        canEditAssignments: false,
      };
    default:
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        canUploadImages: false,
        canEditStatus: false,
        canEditDates: false,
        canEditAssignments: false,
      };
  }
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

// For form state management
export type ActivityFormData = Omit<CreateActivityRequest, 'phaseId'>;

// For optimistic updates
export interface ActivityUpdate {
  activityId: string;
  updates: Partial<Activity>;
}

// For activity filtering
export interface ActivityFilters {
  status?: ActivityStatus[];
  priority?: ActivityPriority[];
  category?: ActivityCategory[];
  assignedTo?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}