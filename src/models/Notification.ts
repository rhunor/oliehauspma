// src/models/Notification.ts
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: [
      'task_assigned',
      'task_completed', 
      'task_updated',
      'project_updated',
      'milestone_reached',
      'deadline_approaching',
      'message_received',
      'file_uploaded',
      'user_mentioned',
      'project_invitation',
      'comment_added'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    url: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
