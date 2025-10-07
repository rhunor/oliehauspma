// src/lib/projects.ts - PROJECT DATABASE UTILITIES WITH MULTIPLE MANAGERS
import { connectToDatabase } from '@/lib/db';
import { ObjectId, UpdateFilter } from 'mongodb';

// Define types for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client: ObjectId;
  managers: ObjectId[]; // FIXED: Changed from manager to managers array
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

// FIXED: Type for insert operations (omits auto-generated _id)
type InsertProjectDocument = Omit<ProjectDocument, '_id'>;

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  phone?: string;
  password?: string;
}

// FIXED: Updated interface to have managers array instead of single manager
interface ProjectWithUsers extends Omit<ProjectDocument, 'client' | 'managers'> {
  client: UserDocument;
  managers: UserDocument[]; // FIXED: Array of managers
}

interface MongoMatchQuery {
  _id?: ObjectId;
  managers?: { $in: ObjectId[] }; // FIXED: Changed to support array matching
  client?: ObjectId;
}

/**
 * Get a project by ID with populated client and managers data
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

    // Role-based access control with multiple managers support
    if (userRole === 'project_manager') {
      // FIXED: Check if userId is in the managers array
      matchQuery.managers = { $in: [new ObjectId(userId)] };
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
        // FIXED: Lookup managers array - MongoDB 5.0+ supports direct lookup on arrays
        {
          $lookup: {
            from: 'users',
            localField: 'managers',
            foreignField: '_id',
            as: 'managersData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            managers: '$managersData' // FIXED: Keep as array, don't use $arrayElemAt
          }
        },
        { $unset: ['clientData', 'managersData'] }
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
      // FIXED: Check if userId is in the managers array
      matchQuery.managers = { $in: [new ObjectId(userId)] };
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
        // FIXED: Lookup managers array
        {
          $lookup: {
            from: 'users',
            localField: 'managers',
            foreignField: '_id',
            as: 'managersData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            managers: '$managersData' // FIXED: Keep as array
          }
        },
        { $unset: ['clientData', 'managersData'] },
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
      // FIXED: Check if userId is in the managers array
      matchQuery.managers = { $in: [new ObjectId(userId)] };
    }
    // super_admin can update any project
    // clients cannot update projects

    if (userRole === 'client') {
      return null; // Clients cannot update projects
    }

    const collection = db.collection<ProjectDocument>('projects');

    // Update the project
    const result = await collection.updateOne(
      matchQuery,
      { 
        $set: { 
          ...updateData, 
          updatedAt: new Date() 
        } 
      }
    );

    // Check if update was successful
    if (result.matchedCount === 0) {
      return null; // Project not found or user not authorized
    }

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

    const newProject: InsertProjectDocument = {
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const collection = db.collection<InsertProjectDocument>('projects');
    const result = await collection.insertOne(newProject);

    if (result.insertedId) {
      // Fetch and return the created project with populated data
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

    const collection = db.collection<ProjectDocument>('projects');
    const result = await collection.deleteOne({
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
      // FIXED: Check if userId is in the managers array
      matchQuery.managers = { $in: [new ObjectId(userId)] };
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

/**
 * Check if a user is a manager of a project
 * @param projectId - The project ID to check
 * @param userId - The user ID to check
 * @returns Boolean indicating if user is a manager
 */
export async function isProjectManager(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)) {
      return false;
    }

    const collection = db.collection<ProjectDocument>('projects');
    const project = await collection.findOne({
      _id: new ObjectId(projectId),
      managers: { $in: [new ObjectId(userId)] }
    });

    return project !== null;
  } catch (error) {
    console.error('Error checking if user is project manager:', error);
    return false;
  }
}

/**
 * Add a manager to a project
 * @param projectId - The project ID
 * @param managerId - The manager ID to add
 * @param userRole - Role of the requesting user (must be super_admin)
 * @returns Boolean indicating success
 */
export async function addProjectManager(
  projectId: string,
  managerId: string,
  userRole: string
): Promise<boolean> {
  try {
    if (userRole !== 'super_admin') {
      return false; // Only super admin can add managers
    }

    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(managerId)) {
      return false;
    }

    // Verify the manager exists and has the correct role
    const userCollection = db.collection<UserDocument>('users');
    const manager = await userCollection.findOne({
      _id: new ObjectId(managerId),
      role: 'project_manager'
    });

    if (!manager) {
      return false;
    }

    const collection = db.collection<ProjectDocument>('projects');
    const update: UpdateFilter<ProjectDocument> = {
      $addToSet: { managers: new ObjectId(managerId) },
      $set: { updatedAt: new Date() }
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      update
    );

    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (error) {
    console.error('Error adding project manager:', error);
    return false;
  }
}

/**
 * Remove a manager from a project
 * @param projectId - The project ID
 * @param managerId - The manager ID to remove
 * @param userRole - Role of the requesting user (must be super_admin)
 * @returns Boolean indicating success
 */
export async function removeProjectManager(
  projectId: string,
  managerId: string,
  userRole: string
): Promise<boolean> {
  try {
    if (userRole !== 'super_admin') {
      return false; // Only super admin can remove managers
    }

    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(managerId)) {
      return false;
    }

    const collection = db.collection<ProjectDocument>('projects');

    // Check if project has more than one manager
    const project = await collection.findOne({
      _id: new ObjectId(projectId)
    });

    if (!project || !project.managers || project.managers.length <= 1) {
      return false; // Cannot remove the last manager
    }

    // Remove manager from the managers array
    const update: UpdateFilter<ProjectDocument> = {
      $pull: { managers: new ObjectId(managerId) },
      $set: { updatedAt: new Date() }
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      update
    );

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error removing project manager:', error);
    return false;
  }
}