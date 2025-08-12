// src/models/File.ts
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'other'],
    required: true
  },
  tags: [String],
  description: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  parentFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: Date,
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    pages: Number,
    compression: String
  }
}, {
  timestamps: true
});

// Indexes
fileSchema.index({ projectId: 1 });
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ category: 1 });
fileSchema.index({ isPublic: 1 });
fileSchema.index({ createdAt: -1 });

const File = mongoose.models.File || mongoose.model('File', fileSchema);

export default File;
