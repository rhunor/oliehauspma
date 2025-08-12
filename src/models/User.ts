// src/models/User.ts
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'project_manager', 'client'],
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      taskAssignments: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      deadlineReminders: { type: Boolean, default: true },
      chatMessages: { type: Boolean, default: true }
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '24h'
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
      },
      showOnlineStatus: { type: Boolean, default: true },
      allowDirectMessages: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastLogin: -1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;