// FILE: src/models/Project.ts - UPDATED WITH MULTIPLE MANAGERS SUPPORT
import mongoose from 'mongoose';

const siteActivitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  contractor: {
    type: String,
    required: true
  },
  plannedDate: {
    type: Date,
    required: true
  },
  actualDate: Date,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'delayed', 'on_hold'],
    default: 'pending'
  },
  comments: String,
  images: [String],
  incidentReport: String,
  supervisor: String,
  dependencies: [String],
  duration: Number,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const dayScheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  dayNumber: {
    type: Number,
    required: true
  },
  activities: [siteActivitySchema]
});

const weekScheduleSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  days: [dayScheduleSchema]
});

const phaseScheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  weeks: [weekScheduleSchema]
});

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // ✅ UPDATED: Changed from single manager to array of managers
  managers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  // ✅ DEPRECATED: Keep for backward compatibility but will migrate data
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  siteAddress: {
    type: String,
    required: true
  },
  scopeOfWork: String,
  designStyle: String,
  status: {
    type: String,
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  startDate: Date,
  endDate: Date,
  projectDuration: String,
  budget: Number,
  progress: {
    type: Number,
    default: 0
  },
  siteSchedule: {
    phases: [phaseScheduleSchema],
    totalActivities: {
      type: Number,
      default: 0
    },
    completedActivities: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  },
  tags: [String],
  notes: String,
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  milestones: [{
    title: String,
    description: String,
    targetDate: Date,
    completedDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'delayed'],
      default: 'pending'
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
projectSchema.index({ client: 1 });
projectSchema.index({ managers: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ startDate: 1, endDate: 1 });

// ✅ NEW: Middleware to ensure managers array is populated
projectSchema.pre('save', function(next) {
  // Migrate old 'manager' field to 'managers' array if needed
  if (this.manager && (!this.managers || this.managers.length === 0)) {
    this.managers = [this.manager];
  }
  
  // Ensure at least one manager
  if (!this.managers || this.managers.length === 0) {
    return next(new Error('Project must have at least one manager'));
  }
  
  next();
});

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;