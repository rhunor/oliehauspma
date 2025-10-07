// FILE: src/models/DailyProgress.ts - UPDATED WITH ON_HOLD STATUS
import mongoose, { Schema, Model, Types } from 'mongoose';

// ✅ UPDATED: Added 'on_hold' status
export interface IDailyActivity {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  contractor: string;
  supervisor: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  plannedDate?: Date;
  actualDate?: Date;
  comments?: string;
  images?: string[];
  incidentReport?: string;
  progress?: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// ✅ UPDATED: Added onHold count
export interface IDailySummary {
  totalActivities: number;
  completed: number;
  inProgress: number;
  pending: number;
  delayed: number;
  onHold: number;
  totalHours?: number;
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

// ✅ UPDATED: Schema with on_hold status
const dailyActivitySchema = new Schema<IDailyActivity>({
  title: {
    type: String,
    required: true
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
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['structural', 'electrical', 'plumbing', 'finishing', 'other'],
    default: 'structural'
  },
  startTime: String,
  endTime: String,
  estimatedDuration: {
    type: Number,
    default: 60
  },
  actualDuration: {
    type: Number
  },
  plannedDate: {
    type: Date
  },
  actualDate: {
    type: Date
  },
  comments: String,
  images: [String],
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

// ✅ UPDATED: Summary schema with onHold field
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
    totalHours: {
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

// ✅ UPDATED: Pre-save middleware to automatically calculate summary including on_hold
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
    
    // Calculate total hours if actual duration is available
    const totalMinutes = activities.reduce((sum, activity) => {
      return sum + (activity.actualDuration || activity.estimatedDuration || 0);
    }, 0);
    this.summary.totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  }
  
  next();
});

// Create the model
const DailyProgress: Model<IDailyProgressDocument> = 
  mongoose.models.DailyProgress || 
  mongoose.model<IDailyProgressDocument>('DailyProgress', dailyProgressSchema);

export default DailyProgress;