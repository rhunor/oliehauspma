// src/models/DailyProgress.ts - UPDATED: Added startDate, endDate, clientComments; Removed duration fields
import mongoose, { Schema, Model, Types } from 'mongoose';

// Client comment interface for activity-specific client feedback
export interface IClientComment {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: string;
  content: string;
  attachments?: string[]; // S3 URLs for any attached images/files
  createdAt: Date;
  updatedAt?: Date;
}

export interface IDailyActivity {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  // ADDED: Required start and end date-time fields
  startDate: Date; // Required - when activity starts
  endDate: Date;   // Required - when activity ends
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent'; // KEPT as requested
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  // REMOVED: estimatedDuration and actualDuration fields completely
  plannedDate?: Date; // Legacy field - keeping for backward compatibility
  actualDate?: Date;  // Legacy field - keeping for backward compatibility
  comments?: string; // Internal manager/admin comments
  // ADDED: Client comments array for client feedback
  clientComments?: IClientComment[];
  images?: string[]; // S3 URLs for uploaded images
  incidentReport?: string;
  progress?: number;
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
  // REMOVED: totalHours field since we removed duration tracking
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
  attachments: [String], // S3 URLs
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, { timestamps: false }); // Disable automatic timestamps for sub-document

// UPDATED: Daily activity schema with new required fields
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
  // ADDED: Required start and end date-time
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
    enum: ['pending', 'in_progress', 'completed', 'delayed', 'on_hold'],
    required: true,
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true // KEPT priority as required
  },
  category: {
    type: String,
    enum: ['structural', 'electrical', 'plumbing', 'finishing', 'other'],
    default: 'other'
  },
  // REMOVED: estimatedDuration and actualDuration completely
  plannedDate: Date, // Legacy - keeping for backward compatibility
  actualDate: Date,  // Legacy - keeping for backward compatibility
  comments: String, // Internal comments
  // ADDED: Client comments array
  clientComments: [clientCommentSchema],
  images: [String], // S3 URLs for images
  incidentReport: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
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
    // REMOVED: totalHours field
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

// UPDATED: Pre-save middleware (removed totalHours calculation)
dailyProgressSchema.pre('save', function(next) {
  if (this.activities && this.activities.length > 0) {
    const activities = this.activities;
    
    // Update summary statistics
    this.summary.totalActivities = activities.length;
    this.summary.completed = activities.filter(a => a.status === 'completed').length;
    this.summary.inProgress = activities.filter(a => a.status === 'in_progress').length;
    this.summary.pending = activities.filter(a => a.status === 'pending').length;
    this.summary.delayed = activities.filter(a => a.status === 'delayed').length;
    this.summary.onHold = activities.filter(a => a.status === 'on_hold').length;
    
    // REMOVED: totalHours calculation
  }
  
  next();
});

// Create the model
const DailyProgress: Model<IDailyProgressDocument> = 
  mongoose.models.DailyProgress || 
  mongoose.model<IDailyProgressDocument>('DailyProgress', dailyProgressSchema);

export default DailyProgress;