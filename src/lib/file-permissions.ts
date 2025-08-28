// src/lib/file-permissions.ts - FIXED: NO ANY TYPES, PROPER INTERFACES
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// FIXED: Proper TypeScript interfaces instead of any
interface ProjectBasic {
  _id: ObjectId;
  title: string;
}

interface UserProject {
  _id: string;
  title: string;
}

// FIXED: Specific user role types
type UserRole = 'super_admin' | 'project_manager' | 'client';

// FIXED: Specific permission types
type FilePermission = 'read' | 'write' | 'delete';

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

// FIXED: Return type for file data
interface ClientFileData {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: string;
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

/**
 * FIXED: Validate file permissions with proper typing
 */
export async function validateFilePermission(
  userId: string, 
  userRole: UserRole, 
  projectId: string, 
  permission: FilePermission
): Promise<boolean> {
  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(projectId)) {
      return false;
    }

    const { db } = await connectToDatabase();

    // Super admin has all permissions
    if (userRole === 'super_admin') {
      return true;
    }

    // Check if project exists
    const project = await db.collection('projects')
      .findOne({ _id: new ObjectId(projectId) });
    
    if (!project) {
      return false;
    }

    if (userRole === 'project_manager') {
      // Project manager can access their assigned projects
      const hasAccess = await db.collection('projects')
        .findOne({ 
          _id: new ObjectId(projectId), 
          manager: new ObjectId(userId) 
        });
      return !!hasAccess;
    }

    if (userRole === 'client') {
      // Clients can only read files from their assigned projects
      if (permission !== 'read') {
        return false;
      }
      
      const hasAccess = await db.collection('projects')
        .findOne({ 
          _id: new ObjectId(projectId), 
          client: new ObjectId(userId) 
        });
      return !!hasAccess;
    }

    return false;
  } catch (error) {
    console.error('Error validating file permission:', error);
    return false;
  }
}

/**
 * FIXED: Get projects a user can upload files to
 */
export async function getUserUploadableProjects(userId: string, userRole: UserRole): Promise<UserProject[]> {
  try {
    const { db } = await connectToDatabase();
    
    const projects: ProjectBasic[] = [];

    if (userRole === 'super_admin') {
      // Super admin can upload to all projects
      const result = await db.collection<ProjectBasic>('projects')
        .find({}, { projection: { title: 1 } })
        .toArray();
      projects.push(...result);
    } else if (userRole === 'project_manager') {
      // Project manager can upload to assigned projects
      const result = await db.collection<ProjectBasic>('projects')
        .find(
          { manager: new ObjectId(userId) },
          { projection: { title: 1 } }
        )
        .toArray();
      projects.push(...result);
    }
    // Clients cannot upload files

    return projects.map((project: ProjectBasic): UserProject => ({
      _id: project._id.toString(),
      title: project.title
    }));
  } catch (error) {
    console.error('Error getting uploadable projects:', error);
    return [];
  }
}

/**
 * FIXED: Get files that a user has access to with proper typing
 */
export async function getUserAccessibleFiles(userId: string, userRole: UserRole, projectId?: string): Promise<ClientFileData[]> {
  try {
    const { db } = await connectToDatabase();

    // FIXED: Build query based on user role and project access with proper typing
    interface ProjectFilter {
      projectId?: ObjectId | { $in: ObjectId[] };
    }
    
    let projectFilter: ProjectFilter = {};

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

    // FIXED: Use proper typing for the map function with FileAggregationResult
    return files.map((file: FileAggregationResult): ClientFileData => ({
      _id: file._id.toString(),
      filename: file.filename,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      url: file.url,
      category: file.category || 'other',
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
 * FIXED: Validate file type and size with proper typing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'text/plain', 'text/csv'
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed`
    };
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds 50MB limit`
    };
  }

  return { valid: true };
}

/**
 * FIXED: Validate file type with proper typing
 */
export function validateFileType(file: File): boolean {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'text/plain', 'text/csv'
  ];
  
  return allowedTypes.includes(file.type);
}

/**
 * FIXED: Validate file size with proper typing
 */
export function validateFileSize(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}