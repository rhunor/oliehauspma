// src/lib/types/milestone.ts - Project Milestone Types
import type { ObjectId } from 'mongodb';

export interface ProjectMilestone {
  _id: string;
  projectId: string;
  phase: 'construction' | 'installation' | 'styling';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedDate?: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneProgress {
  currentPhase: number;
  totalPhases: number;
  completedMilestones: ProjectMilestone[];
  nextMilestone?: ProjectMilestone;
  overallProgress: number;
}

export interface WorkScheduleItem {
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  projectTitle: string;
  phase?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  contractor?: string;
  startDate: string;
  endDate: string;
  estimatedDuration?: string;
  progress: number;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
}

export interface WorkScheduleWidget {
  todayTasks: WorkScheduleItem[];
  upcomingTasks: WorkScheduleItem[];
  totalTasks: number;
  completedToday: number;
  nextMilestone?: {
    title: string;
    dueDate: string;
    daysRemaining: number;
  };
}

// MongoDB Document Interfaces for Backend
export interface MilestoneDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  phase: 'construction' | 'installation' | 'styling';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedDate?: Date;
  completedBy?: ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to transform MongoDB document to client-safe format
export function transformMilestone(doc: MilestoneDocument): ProjectMilestone {
  return {
    _id: doc._id?.toString() || '',
    projectId: doc.projectId.toString(),
    phase: doc.phase,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    completedDate: doc.completedDate?.toISOString(),
    completedBy: doc.completedBy?.toString(),
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

// Constants
export const MILESTONE_PHASES = ['construction', 'installation', 'styling'] as const;
export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export const MILESTONE_PHASE_NAMES: Record<string, string> = {
  construction: 'Construction Phase',
  installation: 'Installation Phase',
  styling: 'Set up and Styling Phase'
};

export const MILESTONE_PHASE_DESCRIPTIONS: Record<string, string> = {
  construction: 'Complete all structural and foundational construction work',
  installation: 'Install all fixtures, utilities, and essential systems',
  styling: 'Complete interior design, styling, and final setup'
};