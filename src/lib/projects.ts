// src/lib/projects.ts - PROJECT DATABASE UTILITIES
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Define types for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client: ObjectId;
  manager: ObjectId;
  siteAddress?: string;
  scopeOfWork?: string;
  designStyle?: string;
  startDate?: Date;
  endDate?: Date;
  projectDuration?: string;
  budget?: number;
  progress: number;
  siteSchedule?: unknown;
  projectCoordinator?: string;
  siteOfficer?: string;
  workDays?: string[];
  files?: unknown[];
  milestones?: unknown[];
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  phone?: string;
  password?: string;
}

interface ProjectWithUsers extends Omit<ProjectDocument, 'client' | 'manager'> {
  client: UserDocument;
  manager: UserDocument;
}

interface MongoMatchQuery {
  _id?: ObjectId;
  manager?: ObjectId;
  client?: ObjectId;
}

/**
 * Get a project by ID with populated client and manager data
 * @param projectId - The project ID to fetch
 * @param userRole - Role of the requesting user for authorization
 * @param userId - ID of the requesting user for authorization
 * @returns Project with populated user data or null if not found/unauthorized
 */
export async function getProjectById(
  projectId: string, 
  userRole: string, 
  userId: string
): Promise<ProjectWithUsers | null> {
  try {
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId)) {
      return null;
    }

    // Build query based on user role
    const matchQuery: MongoMatchQuery = { _id: new ObjectId(projectId) };

    // Role-based access control
    if (userRole === 'project_manager') {
      matchQuery.manager = new ObjectId(userId);
    } else if (userRole === 'client') {
      matchQuery.client = new ObjectId(userId);
    }
    // super_admin can access all projects (no additional filter)

    const project = await db.collection('projects')
      .aggregate<ProjectWithUsers>([
        { 
          $match: matchQuery
        },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] }
      ])
      .toArray();

    return project[0] || null;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

/**
 * Get all projects with populated user data
 * @param userRole - Role of the requesting user
 * @param userId - ID of the requesting user
 * @returns Array of projects with populated user data
 */
export async function getProjects(userRole: string, userId: string): Promise<ProjectWithUsers[]> {
  try {
    const { db } = await connectToDatabase();

    // Build query based on user role
    const matchQuery: MongoMatchQuery = {};

    if (userRole === 'project_manager') {
      matchQuery.manager = new ObjectId(userId);
    } else if (userRole === 'client') {
      matchQuery.client = new ObjectId(userId);
    }
    // super_admin can see all projects (no filter)

    const projects = await db.collection('projects')
      .aggregate<ProjectWithUsers>([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

/**
 * Update a project by ID
 * @param projectId - The project ID to update
 * @param updateData - Data to update
 * @param userRole - Role of the requesting user
 * @param userId - ID of the requesting user
 * @returns Updated project or null if not found/unauthorized
 */
export async function updateProject(
  projectId: string,
  updateData: Partial<ProjectDocument>,
  userRole: string,
  userId: string
): Promise<ProjectWithUsers | null> {
  try {
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId)) {
      return null;
    }

    // Build query based on user role for authorization
    const matchQuery: MongoMatchQuery = { _id: new ObjectId(projectId) };

    if (userRole === 'project_manager') {
      matchQuery.manager = new ObjectId(userId);
    }
    // super_admin can update any project
    // clients cannot update projects

    if (userRole === 'client') {
      return null; // Clients cannot update projects
    }

    // Update the project
    await db.collection('projects').updateOne(
      matchQuery,
      { 
        $set: { 
          ...updateData, 
          updatedAt: new Date() 
        } 
      }
    );

    // Return the updated project
    return await getProjectById(projectId, userRole, userId);
  } catch (error) {
    console.error('Error updating project:', error);
    return null;
  }
}

/**
 * Create a new project (admin only)
 * @param projectData - Project data to create
 * @param userRole - Role of the requesting user
 * @returns Created project or null if unauthorized
 */
export async function createProject(
  projectData: Omit<ProjectDocument, '_id' | 'createdAt' | 'updatedAt'>,
  userRole: string
): Promise<ProjectWithUsers | null> {
  try {
    if (userRole !== 'super_admin') {
      return null; // Only super admin can create projects
    }

    const { db } = await connectToDatabase();

    const newProject = {
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('projects').insertOne(newProject);

    if (result.insertedId) {
      return await getProjectById(result.insertedId.toString(), userRole, '');
    }

    return null;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

/**
 * Delete a project by ID (admin only)
 * @param projectId - The project ID to delete
 * @param userRole - Role of the requesting user
 * @returns Boolean indicating success
 */
export async function deleteProject(
  projectId: string,
  userRole: string
): Promise<boolean> {
  try {
    if (userRole !== 'super_admin') {
      return false; // Only super admin can delete projects
    }

    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId)) {
      return false;
    }

    const result = await db.collection('projects').deleteOne({
      _id: new ObjectId(projectId)
    });

    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

/**
 * Get project statistics for dashboard
 * @param userRole - Role of the requesting user
 * @param userId - ID of the requesting user
 * @returns Project statistics object
 */
export async function getProjectStats(userRole: string, userId: string) {
  try {
    const { db } = await connectToDatabase();

    // Build match query based on user role
    const matchQuery: MongoMatchQuery = {};

    if (userRole === 'project_manager') {
      matchQuery.manager = new ObjectId(userId);
    } else if (userRole === 'client') {
      matchQuery.client = new ObjectId(userId);
    }

    const stats = await db.collection('projects').aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          planning: {
            $sum: { $cond: [{ $eq: ['$status', 'planning'] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          onHold: {
            $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          avgProgress: { $avg: '$progress' },
          totalBudget: { $sum: '$budget' }
        }
      }
    ]).toArray();

    return stats[0] || {
      total: 0,
      planning: 0,
      inProgress: 0,
      completed: 0,
      onHold: 0,
      cancelled: 0,
      avgProgress: 0,
      totalBudget: 0
    };
  } catch (error) {
    console.error('Error fetching project stats:', error);
    return {
      total: 0,
      planning: 0,
      inProgress: 0,
      completed: 0,
      onHold: 0,
      cancelled: 0,
      avgProgress: 0,
      totalBudget: 0
    };
  }
}