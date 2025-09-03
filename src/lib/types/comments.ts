// src/lib/types/comments.ts - Enhanced Comment System Types
export interface TaskComment {
  _id: string;
  taskId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: 'client' | 'project_manager' | 'super_admin';
  isInternal: boolean; // Internal comments only visible to team members
  mentions?: string[]; // User IDs mentioned in comment
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  parentCommentId?: string; // For threaded replies
  edited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentThread {
  comment: TaskComment;
  replies: TaskComment[];
  replyCount: number;
}

// MongoDB Document Interfaces for Backend
export interface MilestoneDocument {
  _id?: import('mongodb').ObjectId;
  projectId: import('mongodb').ObjectId;
  phase: 'construction' | 'installation' | 'styling';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedDate?: Date;
  completedBy?: import('mongodb').ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentReportDocument {
  _id?: import('mongodb').ObjectId;
  projectId: import('mongodb').ObjectId;
  title: string;
  description: string;
  category: 'safety' | 'equipment' | 'environmental' | 'security' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  dateOccurred: Date;
  timeOccurred?: string;
  reportedBy: import('mongodb').ObjectId;
  witnessNames?: string[];
  injuryDetails?: {
    injuryType: 'none' | 'minor' | 'major' | 'fatality';
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved?: string[];
  weatherConditions?: string;
  immediateActions?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: import('mongodb').ObjectId;
  photos?: string[];
  documents?: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRegisterDocument {
  _id?: import('mongodb').ObjectId;
  projectId: import('mongodb').ObjectId;
  riskCode?: string;
  riskDescription: string;
  category: 'technical' | 'financial' | 'schedule' | 'safety' | 'quality' | 'environmental' | 'legal' | 'operational';
  probability: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number;
  triggers?: string[];
  mitigationStrategy: string;
  contingencyPlan?: string;
  owner: import('mongodb').ObjectId;
  status: 'identified' | 'assessed' | 'mitigated' | 'transferred' | 'accepted' | 'closed';
  reviewDate?: Date;
  lastReviewDate?: Date;
  residualProbability?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualImpact?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualScore?: number;
  actionItems?: Array<{
    action: string;
    assignedTo: import('mongodb').ObjectId;
    dueDate: Date;
    status: 'pending' | 'in_progress' | 'completed';
    completedDate?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}