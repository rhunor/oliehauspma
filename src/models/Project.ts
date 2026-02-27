// src/models/Project.ts - UPDATED: Enhanced activity schema with comments
import mongoose from 'mongoose';

// Activity comment sub-schema
const activityCommentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorRole: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String // S3 URLs
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, { _id: true, timestamps: true });

// Enhanced activity schema with proper typing
const activitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['to-do', 'in_progress', 'completed', 'delayed', 'on_hold'],
    default: 'to-do',
    required: true
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
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  comments: [activityCommentSchema],
  images: [{
    type: String // S3 URLs
  }],
  contractor: String,
  supervisor: String,
  estimatedDuration: String,
  actualDuration: String,
  resources: [String],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Phase schema (contains activities)
const phaseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
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
    enum: ['upcoming', 'active', 'completed', 'delayed'],
    default: 'upcoming'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  activities: [activitySchema],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId
  }]
}, { timestamps: true });

// Main project schema
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
  managers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
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
  projectCoordinator: { type: String, default: '' },
  siteOfficer: { type: String, default: '' },
  workDays: { type: String, default: '' },
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
    phases: [phaseSchema],
    totalActivities: {
      type: Number,
      default: 0
    },
    completedActivities: {
      type: Number,
      default: 0
    },
    activeActivities: {
      type: Number,
      default: 0
    },
    delayedActivities: {
      type: Number,
      default: 0
    },
    lastUpdated: Date,
    overallProgress: {
      type: Number,
      default: 0
    }
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
projectSchema.index({ 'siteSchedule.phases.activities._id': 1 });

// Middleware to ensure managers array is populated
projectSchema.pre('save', function(next) {
  if (this.manager && (!this.managers || this.managers.length === 0)) {
    this.managers = [this.manager];
  }
  
  if (!this.managers || this.managers.length === 0) {
    return next(new Error('Project must have at least one manager'));
  }
  
  next();
});

// Middleware to auto-update progress when activities change
projectSchema.pre('save', function(next) {
  if (this.siteSchedule && this.siteSchedule.phases) {
    const phases = this.siteSchedule.phases;
    
    let totalActivities = 0;
    let completedActivities = 0;
    let activeActivities = 0;
    let delayedActivities = 0;
    
    phases.forEach(phase => {
      if (phase.activities) {
        totalActivities += phase.activities.length;
        
        phase.activities.forEach(activity => {
          if (activity.status === 'completed') completedActivities++;
          if (activity.status === 'in_progress') activeActivities++;
          if (activity.status === 'delayed') delayedActivities++;
        });
        
        // Calculate phase progress
        if (phase.activities.length > 0) {
          const phaseCompleted = phase.activities.filter(a => a.status === 'completed').length;
          phase.progress = Math.round((phaseCompleted / phase.activities.length) * 100);
          
          // Update phase status based on progress and dates
          if (phase.progress === 100) {
            phase.status = 'completed';
          } else if (phase.progress > 0) {
            phase.status = 'active';
          }
        }
      }
    });
    
    // Update site schedule statistics
    this.siteSchedule.totalActivities = totalActivities;
    this.siteSchedule.completedActivities = completedActivities;
    this.siteSchedule.activeActivities = activeActivities;
    this.siteSchedule.delayedActivities = delayedActivities;
    this.siteSchedule.overallProgress = totalActivities > 0
      ? Math.round((completedActivities / totalActivities) * 100)
      : 0;
    this.siteSchedule.lastUpdated = new Date();
    
    // Update overall project progress
    this.progress = this.siteSchedule.overallProgress;
    
    // Auto-complete project when all activities are done
    if (completedActivities > 0 && completedActivities === totalActivities) {
      this.status = 'completed';
    } else if (activeActivities > 0) {
      if (this.status === 'planning') {
        this.status = 'in_progress';
      }
    }
  }
  
  next();
});

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;