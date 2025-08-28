// src/types/files.ts - SHARED FILE TYPES TO PREVENT INTERFACE MISMATCHES
// FIXED: Separated types from constants to fix import issues

// FIXED: Specific user role types
export type UserRole = 'super_admin' | 'project_manager' | 'client';

// FIXED: Specific permission types
export type FilePermission = 'read' | 'write' | 'delete';

// FIXED: Specific category types to match FilesList interface expectations
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

// FIXED: Unified FileData interface used across all file components
export interface FileData {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: FileCategory; // FIXED: Use proper type instead of string
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  project: {
    _id: string;
    title: string;
  };
  createdAt: string;
  downloadCount: number;
}

// FIXED: Upload file state interface
export interface UploadFile {
  file: File;
  id: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// FIXED: User project interface
export interface UserProject {
  _id: string;
  title: string;
}

// FIXED: File upload API response interface
export interface FileUploadResponse {
  success: boolean;
  data: FileData;
  message: string;
}

// FIXED: File statistics interface
export interface FileStats {
  total: number;
  totalSize: number;
  byCategory: Record<string, number>;
}

// FIXED: Projects API response interface
export interface ProjectsApiResponse {
  success: boolean;
  projects: UserProject[];
}

// FIXED: Generic error response interface
export interface ErrorResponse {
  success: false;
  error: string;
}

// FIXED: Component props interfaces with proper typing
export interface SecureFileUploadProps {
  userRole: UserRole;
  onUploadComplete?: (file: FileData) => void;
  maxFiles?: number;
  acceptedTypes?: readonly string[] | string[];
  preSelectedProjectId?: string;
}

export interface FilesClientProps {
  files: FileData[];
  stats: FileStats;
  userProjects: UserProject[];
  userRole: UserRole;
}