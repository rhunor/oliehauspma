// ========================================
// src/lib/file-security.ts - FIXED TYPESCRIPT ERRORS
// ========================================

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// TypeScript interfaces for file security
export interface FileAccessRequest {
  fileId: string;
  userId: string;
  userRole: string;
  action: 'view' | 'download' | 'delete';
}

export interface FilePermissionResult {
  hasAccess: boolean;
  reason?: string;
  file?: FileData; // FIXED: Specify proper type instead of any
}

export interface SecureFileResponse {
  success: boolean;
  data?: FileData; // FIXED: Specify proper type instead of any
  error?: string;
  code?: number;
}

// FIXED: Define proper file data interface
interface FileData {
  _id: ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  size: number;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  isPublic: boolean;
  project?: {
    _id: ObjectId;
    title: string;
    client: ObjectId;
    manager: ObjectId;
  };
}

/**
 * Check if user has access to a specific file
 */
export async function checkFileAccess(
  fileId: string,
  userId: string,
  userRole: string,
  action: 'view' | 'download' | 'delete' = 'view'
): Promise<FilePermissionResult> {
  try {
    if (!fileId || !ObjectId.isValid(fileId)) {
      return {
        hasAccess: false,
        reason: 'Invalid file ID'
      };
    }

    const { db } = await connectToDatabase();
    const fileObjectId = new ObjectId(fileId);
    const userObjectId = new ObjectId(userId);

    // Get file with project information
    const fileResults = await db.collection('files').aggregate([
      { $match: { _id: fileObjectId } },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$project', 0] }
        }
      }
    ]).toArray();

    if (fileResults.length === 0) {
      return {
        hasAccess: false,
        reason: 'File not found'
      };
    }

    const fileData = fileResults[0] as FileData;

    // Super admin has access to everything
    if (userRole === 'super_admin') {
      return {
        hasAccess: true,
        file: fileData
      };
    }

    // File uploader can access their own files (except delete for clients)
    if (fileData.uploadedBy.equals(userObjectId)) {
      if (action === 'delete' && userRole === 'client') {
        return {
          hasAccess: false,
          reason: 'Clients cannot delete files'
        };
      }
      return {
        hasAccess: true,
        file: fileData
      };
    }

    // Public files can be viewed/downloaded by authenticated users
    if (fileData.isPublic && action !== 'delete') {
      return {
        hasAccess: true,
        file: fileData
      };
    }

    // Project-based access control
    if (fileData.project) {
      const project = fileData.project;

      switch (userRole) {
        case 'project_manager':
          // Managers can access files in their assigned projects
          if (project.manager && project.manager.equals(userObjectId)) {
            return {
              hasAccess: true,
              file: fileData
            };
          }
          break;

        case 'client':
          // Clients can view/download files in their projects
          if (project.client && project.client.equals(userObjectId)) {
            if (action === 'delete') {
              return {
                hasAccess: false,
                reason: 'Clients cannot delete files'
              };
            }
            return {
              hasAccess: true,
              file: fileData
            };
          }
          break;
      }
    }

    return {
      hasAccess: false,
      reason: 'Access denied - insufficient permissions'
    };

  } catch (error) {
    console.error('Error checking file access:', error);
    return {
      hasAccess: false,
      reason: 'Internal server error'
    };
  }
}

/**
 * Validate file type and size for uploads
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // File size limit: 50MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  
  // Allowed MIME types
  const ALLOWED_TYPES = [
    // Images
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    // Video
    'video/mp4',
    'video/webm',
    'video/quicktime',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ];

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`
    };
  }

  // Additional filename validation
  const filename = file.name;
  if (filename.length > 255) {
    return {
      valid: false,
      error: 'Filename too long (max 255 characters)'
    };
  }

  // Check for potentially dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (dangerousExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: 'File type not allowed for security reasons'
    };
  }

  return { valid: true };
}

/**
 * Get file category based on MIME type
 */
export function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType.includes('text')
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Generate secure filename to prevent conflicts
 */
export function generateSecureFilename(originalName: string): string {
  // Remove potentially dangerous characters
  const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Add timestamp to prevent conflicts
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  
  const extension = sanitized.substring(sanitized.lastIndexOf('.'));
  const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
  
  return `${nameWithoutExt}_${timestamp}_${randomString}${extension}`;
}

/**
 * Create audit log entry for file operations
 */
export async function logFileOperation(
  action: string,
  fileId: string,
  userId: string,
  userEmail: string,
  details?: Record<string, unknown> // FIXED: Specify proper type instead of any
) {
  try {
    const { db } = await connectToDatabase();
    
    await db.collection('file_audit_logs').insertOne({
      action,
      fileId: new ObjectId(fileId),
      userId: new ObjectId(userId),
      userEmail,
      details: details || {},
      timestamp: new Date(),
      ipAddress: null, // Add IP address if available
      userAgent: null  // Add user agent if available
    });
  } catch (error) {
    // Non-critical error - log but don't fail the operation
    console.error('Error logging file operation:', error);
  }
}

/**
 * Middleware wrapper for file operations
 */
export async function withFileAuth(
  handler: (fileData: FileData, session: SessionData) => Promise<Response>, // FIXED: Specify proper types
  fileId: string,
  requiredAction: 'view' | 'download' | 'delete' = 'view'
) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check file access permissions
    const accessResult = await checkFileAccess(
      fileId,
      session.user.id,
      session.user.role,
      requiredAction
    );

    if (!accessResult.hasAccess || !accessResult.file) {
      return new Response(
        JSON.stringify({ 
          error: accessResult.reason || 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the operation
    await logFileOperation(
      requiredAction,
      fileId,
      session.user.id,
      session.user.email || '',
      { fileName: accessResult.file.originalName }
    );

    // Call the actual handler with file data and session
    return await handler(accessResult.file, session);

  } catch (error) {
    console.error('Error in file auth middleware:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// FIXED: Define session data type
interface SessionData {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}