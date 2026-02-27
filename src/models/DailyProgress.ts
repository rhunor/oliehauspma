// src/models/DailyProgress.ts - UPDATED: Added linking fields to Project.siteSchedule
import mongoose, { Schema, Model, Types } from 'mongoose';

// Client comment interface for activity-specific client feedback
export interface IClientComment {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// UPDATED: Added linking fields
export interface IDailyActivity {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  startDate: Date;
  endDate: Date;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  plannedDate?: Date;
  actualDate?: Date;
  comments?: string;
  clientComments?: IClientComment[];
  images?: string[];
  incidentReport?: string;
  progress?: number;
  
  // OliveHaus construction phases
  phase?: 'site_preliminaries' | 'construction' | 'installation' | 'setup_styling' | 'post_handover';
  weekNumber?: number;

  // NEW: Link to Project.siteSchedule activities
  linkedActivityId?: Types.ObjectId; // References Project.siteSchedule.phases[].activities[]._id
  linkedPhaseId?: Types.ObjectId;    // References Project.siteSchedule.phases[]._id
  linkedProjectId?: Types.ObjectId;  // References Project._id (redundant but useful for queries)
  syncEnabled?: boolean;              // If true, updates sync to Project.siteSchedule
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDailySummary {
  totalActivities: number;
  completed: number;
  inProgress: number;
  pending: number;
  delayed: number;
  onHold?: number;
  toDo?: number;
  crewSize?: number;
}

export interface IDailyProgress {
  project: Types.ObjectId;
  date: Date;
  activities: IDailyActivity[];
  summary: IDailySummary;
  weatherCondition?: string;
  siteCondition?: string;
  generalNotes?: string;
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  approved: boolean;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDailyProgressDocument extends IDailyProgress, mongoose.Document {
  _id: Types.ObjectId;
}

// Client comment sub-schema
const clientCommentSchema = new Schema<IClientComment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, { timestamps: false });

// UPDATED: Daily activity schema with linking fields
const dailyActivitySchema = new Schema<IDailyActivity>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  contractor: {
    type: String,
    required: true
  },
  supervisor: {
    type: String,
    required: false
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['to-do', 'pending', 'in_progress', 'completed', 'delayed', 'on_hold'],
    required: true,
    default: 'to-do'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true
  },
  category: {
    type: String,
    enum: ['structural', 'electrical', 'plumbing', 'finishing', 'other'],
    default: 'other'
  },
  plannedDate: Date,
  actualDate: Date,
  comments: String,
  clientComments: [clientCommentSchema],
  images: [String],
  incidentReport: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // OliveHaus construction phases
  phase: {
    type: String,
    enum: ['site_preliminaries', 'construction', 'installation', 'setup_styling', 'post_handover'],
    default: 'construction'
  },
  weekNumber: {
    type: Number,
    min: 1,
    default: 1
  },

  // NEW: Linking fields
  linkedActivityId: {
    type: Schema.Types.ObjectId,
    ref: 'Project', // References activity within Project.siteSchedule
    required: false
  },
  linkedPhaseId: {
    type: Schema.Types.ObjectId,
    ref: 'Project', // References phase within Project.siteSchedule
    required: false
  },
  linkedProjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  syncEnabled: {
    type: Boolean,
    default: false // Manual sync by default
  },
  
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const dailyProgressSchema = new Schema<IDailyProgressDocument>({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  activities: [dailyActivitySchema],
  summary: {
    totalActivities: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    inProgress: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    delayed: {
      type: Number,
      default: 0
    },
    onHold: {
      type: Number,
      default: 0
    },
    toDo: {
      type: Number,
      default: 0
    },
    crewSize: {
      type: Number,
      default: 0
    }
  },
  weatherCondition: String,
  siteCondition: String,
  generalNotes: String,
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  submittedAt: Date,
  approved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

// Add indexes for better query performance
dailyProgressSchema.index({ project: 1, date: -1 });
dailyProgressSchema.index({ 'activities.status': 1 });
dailyProgressSchema.index({ 'activities.priority': 1 });
dailyProgressSchema.index({ 'activities.category': 1 });
dailyProgressSchema.index({ 'activities.startDate': 1 });
dailyProgressSchema.index({ 'activities.endDate': 1 });

// NEW: Indexes for linked activities
dailyProgressSchema.index({ 'activities.linkedActivityId': 1 });
dailyProgressSchema.index({ 'activities.linkedPhaseId': 1 });
dailyProgressSchema.index({ 'activities.linkedProjectId': 1 });

// Pre-save middleware to update summary statistics
dailyProgressSchema.pre('save', function(next) {
  if (this.activities && this.activities.length > 0) {
    const activities = this.activities;
    
    this.summary.totalActivities = activities.length;
    this.summary.completed = activities.filter(a => a.status === 'completed').length;
    this.summary.inProgress = activities.filter(a => a.status === 'in_progress').length;
    this.summary.pending = activities.filter(a => a.status === 'pending').length;
    this.summary.delayed = activities.filter(a => a.status === 'delayed').length;
    this.summary.onHold = activities.filter(a => a.status === 'on_hold').length;
    this.summary.toDo = activities.filter(a => a.status === 'to-do').length;
  }
  
  next();
});

// Create the model
const DailyProgress: Model<IDailyProgressDocument> = 
  mongoose.models.DailyProgress || 
  mongoose.model<IDailyProgressDocument>('DailyProgress', dailyProgressSchema);

export default DailyProgress;