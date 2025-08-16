// src/lib/file-permissions.ts - FIXED TYPE ERRORS ONLY
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/db';

export interface FilePermissionData {
  userId: string;
  userRole: string;
  projectId: string;
  action: 'read' | 'write' | 'delete';
}

/**
 * Validates if a user can perform actions on files for a specific project
 * Super Admin: Full access to all project files
 * Project Manager: Upload/manage files for assigned projects
 * Client: View files from their projects only
 */
export async function validateFilePermission(
  userId: string,
  userRole: string,
  projectId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId)) {
      return false;
    }

    // Super admin has full access to all files
    if (userRole === 'super_admin') {
      return true;
    }

    // Get project details to check access
    const project = await db.collection('projects').findOne(
      { _id: new ObjectId(projectId) },
      { projection: { client: 1, manager: 1 } }
    );

    if (!project) {
      return false;
    }

    const userObjectId = new ObjectId(userId);

    // Project manager permissions
    if (userRole === 'project_manager') {
      const isAssignedManager = project.manager.equals(userObjectId);
      if (!isAssignedManager) {
        return false;
      }
      // Managers can read and write files for their projects
      return action === 'read' || action === 'write';
    }

    // Client permissions
    if (userRole === 'client') {
      const isAssignedClient = project.client.equals(userObjectId);
      if (!isAssignedClient) {
        return false;
      }
      // Clients can only read files from their projects
      return action === 'read';
    }

    return false;
  } catch (error) {
    console.error('Error validating file permission:', error);
    return false;
  }
}

/**
 * Get projects that a user can upload files to
 */
export async function getUserUploadableProjects(userId: string, userRole: string): Promise<Array<{ _id: string; title: string }>> {
  try {
    const { db } = await connectToDatabase();
    
    // Define the interface for projects from database
    interface ProjectBasic {
      _id: ObjectId;
      title: string;
    }
    
    let projects: ProjectBasic[] = [];

    if (userRole === 'super_admin') {
      // Super admin can upload to all projects
      const result = await db.collection('projects')
        .find({}, { projection: { title: 1 } })
        .toArray();
      projects = result as ProjectBasic[];
    } else if (userRole === 'project_manager') {
      // Project manager can upload to assigned projects
      const result = await db.collection('projects')
        .find(
          { manager: new ObjectId(userId) },
          { projection: { title: 1 } }
        )
        .toArray();
      projects = result as ProjectBasic[];
    }
    // Clients cannot upload files

    return projects.map((project: ProjectBasic) => ({
      _id: project._id.toString(),
      title: project.title
    }));
  } catch (error) {
    console.error('Error getting uploadable projects:', error);
    return [];
  }
}

// Type definition for aggregation result from files collection
interface FileAggregationResult {
  _id: ObjectId;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category?: string;
  tags?: string[];
  description?: string;
  isPublic?: boolean;
  downloadCount?: number;
  createdAt: Date;
  uploadedBy: {
    _id: ObjectId;
    name: string;
    email: string;
  };
  project: {
    _id: ObjectId;
    title: string;
  };
}

/**
 * Get files that a user has access to
 */
export async function getUserAccessibleFiles(userId: string, userRole: string, projectId?: string) {
  try {
    const { db } = await connectToDatabase();

    // Build query based on user role and project access
    let projectFilter = {};

    if (userRole === 'super_admin') {
      // Super admin can see all files
      if (projectId && ObjectId.isValid(projectId)) {
        projectFilter = { projectId: new ObjectId(projectId) };
      }
    } else if (userRole === 'project_manager') {
      // Get manager's assigned projects
      const managerProjects = await db.collection('projects')
        .find(
          { manager: new ObjectId(userId) },
          { projection: { _id: 1 } }
        )
        .toArray();
      
      const projectIds = managerProjects.map((p: { _id: ObjectId }) => p._id);
      
      if (projectId && ObjectId.isValid(projectId)) {
        // Check if the specific project is in manager's assigned projects
        const hasAccess = projectIds.some((id: ObjectId) => id.equals(new ObjectId(projectId)));
        if (!hasAccess) {
          return [];
        }
        projectFilter = { projectId: new ObjectId(projectId) };
      } else {
        projectFilter = { projectId: { $in: projectIds } };
      }
    } else if (userRole === 'client') {
      // Get client's assigned projects
      const clientProjects = await db.collection('projects')
        .find(
          { client: new ObjectId(userId) },
          { projection: { _id: 1 } }
        )
        .toArray();
      
      const projectIds = clientProjects.map((p: { _id: ObjectId }) => p._id);
      
      if (projectId && ObjectId.isValid(projectId)) {
        // Check if the specific project is in client's assigned projects
        const hasAccess = projectIds.some((id: ObjectId) => id.equals(new ObjectId(projectId)));
        if (!hasAccess) {
          return [];
        }
        projectFilter = { projectId: new ObjectId(projectId) };
      } else {
        projectFilter = { projectId: { $in: projectIds } };
      }
    }

    // Get files with project and uploader details
    const files = await db.collection('files')
      .aggregate<FileAggregationResult>([
        { $match: projectFilter },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'uploadedBy',
            foreignField: '_id',
            as: 'uploaderData',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$projectData', 0] },
            uploadedBy: { $arrayElemAt: ['$uploaderData', 0] }
          }
        },
        { $unset: ['projectData', 'uploaderData'] },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    // FIXED TYPE ERROR: Use proper typing for the map function with FileAggregationResult
    return files.map((file: FileAggregationResult) => ({
      _id: file._id.toString(),
      filename: file.filename,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      url: file.url,
      category: file.category,
      tags: file.tags || [],
      description: file.description || '',
      isPublic: file.isPublic || false,
      uploadedBy: {
        _id: file.uploadedBy._id.toString(),
        name: file.uploadedBy.name,
        email: file.uploadedBy.email
      },
      project: {
        _id: file.project._id.toString(),
        title: file.project.title
      },
      createdAt: file.createdAt.toISOString(),
      downloadCount: file.downloadCount || 0
    }));
  } catch (error) {
    console.error('Error getting accessible files:', error);
    return [];
  }
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = [
    // Images
    'image/jpeg',
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
    'text/plain',
    'text/csv',
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    // Audio
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 50MB limit' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
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
  if (mimeType.includes('pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('spreadsheet') || 
      mimeType.includes('presentation') ||
      mimeType.includes('text/')) return 'document';
  return 'other';
}