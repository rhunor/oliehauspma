// FILE: src/models/DailyProgress.ts - ENHANCED VERSION
// ✅ ENHANCED: Extended IDailyActivity interface to support frontend features

import mongoose, { Schema, Model, Types } from 'mongoose';

// ✅ ENHANCED: Extended IDailyActivity interface with all properties the frontend needs
export interface IDailyActivity {
  _id?: Types.ObjectId;
  title: string;
  description?: string; // ✅ ADDED: Activity description
  contractor: string;
  supervisor: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority?: 'low' | 'medium' | 'high' | 'urgent'; // ✅ ADDED: Priority levels
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other'; // ✅ ADDED: Activity categories
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number; // ✅ ADDED: Estimated duration in minutes
  actualDuration?: number; // ✅ ADDED: Actual duration in minutes
  plannedDate?: Date; // ✅ ADDED: Planned start date
  actualDate?: Date; // ✅ ADDED: Actual completion date
  comments?: string;
  images?: string[];
  incidentReport?: string;
  progress?: number; // ✅ ADDED: Progress percentage (0-100)
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
  totalHours?: number; // ✅ ADDED: Total hours worked
  crewSize?: number; // ✅ ADDED: Number of crew members
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

// ✅ ENHANCED: Updated schema with new fields
const dailyActivitySchema = new Schema<IDailyActivity>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: '' // ✅ ADDED: Description field
  },
  contractor: {
    type: String,
    required: true
  },
  supervisor: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'delayed'],
    required: true,
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium' // ✅ ADDED: Priority field
  },
  category: {
    type: String,
    enum: ['structural', 'electrical', 'plumbing', 'finishing', 'other'],
    default: 'structural' // ✅ ADDED: Category field
  },
  startTime: String,
  endTime: String,
  estimatedDuration: {
    type: Number,
    default: 60 // ✅ ADDED: Estimated duration in minutes
  },
  actualDuration: {
    type: Number // ✅ ADDED: Actual duration in minutes
  },
  plannedDate: {
    type: Date // ✅ ADDED: Planned start date
  },
  actualDate: {
    type: Date // ✅ ADDED: Actual completion date
  },
  comments: String,
  images: [String],
  incidentReport: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0 // ✅ ADDED: Progress percentage
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

// ✅ ENHANCED: Updated summary schema
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
    totalHours: {
      type: Number,
      default: 0 // ✅ ADDED: Total hours field
    },
    crewSize: {
      type: Number,
      default: 0 // ✅ ADDED: Crew size field
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

// ✅ ENHANCED: Pre-save middleware to automatically calculate summary
dailyProgressSchema.pre('save', function(next) {
  if (this.activities && this.activities.length > 0) {
    const activities = this.activities;
    
    // Update summary statistics
    this.summary.totalActivities = activities.length;
    this.summary.completed = activities.filter(a => a.status === 'completed').length;
    this.summary.inProgress = activities.filter(a => a.status === 'in_progress').length;
    this.summary.pending = activities.filter(a => a.status === 'pending').length;
    this.summary.delayed = activities.filter(a => a.status === 'delayed').length;
    
    // Calculate total hours if actual duration is available
    const totalMinutes = activities.reduce((sum, activity) => {
      return sum + (activity.actualDuration || activity.estimatedDuration || 0);
    }, 0);
    this.summary.totalHours = Math.round((totalMinutes / 60) * 100) / 100; // Convert to hours with 2 decimal places
  }
  
  next();
});

// Create the model
const DailyProgress: Model<IDailyProgressDocument> = 
  mongoose.models.DailyProgress || 
  mongoose.model<IDailyProgressDocument>('DailyProgress', dailyProgressSchema);

export default DailyProgress;