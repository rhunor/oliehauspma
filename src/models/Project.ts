// src/models/Project.ts
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
    enum: ['pending', 'in_progress', 'completed', 'delayed'],
    default: 'pending'
  },
  comments: String,
  images: [String],
  incidentReport: String,
  supervisor: String,
  dependencies: [String], // IDs of activities this depends on
  duration: Number, // in days
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
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  projectDuration: String, // e.g., "9 weeks"
  budget: Number,
  progress: {
    type: Number,
    default: 0
  },
  // Site Schedule - replacing tasks
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
  // Project team
  projectCoordinator: {
    name: String,
    phone: String
  },
  siteOfficer: {
    name: String,
    phone: String
  },
  workDays: {
    type: String,
    default: "Monday - Saturday (except public holidays)"
  },
  files: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  milestones: [{
    name: String,
    description: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    }
  }],
  tags: [String],
  notes: String
}, {
  timestamps: true
});

// Calculate progress based on completed activities
projectSchema.pre('save', function(next) {
  if (this.siteSchedule && this.siteSchedule.totalActivities > 0) {
    this.progress = Math.round(
      (this.siteSchedule.completedActivities / this.siteSchedule.totalActivities) * 100
    );
  }
  next();
});

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;

