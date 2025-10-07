// FILE: src/lib/projectUtils.ts - PROJECT UTILITIES FOR PROGRESS & NOTIFICATIONS
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  managers: ObjectId[];
  progress: number;
  status: string;
}

interface DailyProgressDocument {
  project: ObjectId;
  summary: {
    totalActivities: number;
    completed: number;
  };
}

/**
 * Calculate and update project progress based on daily activities
 */
export async function updateProjectProgress(projectId: string): Promise<number> {
  try {
    const { db } = await connectToDatabase();

    // Get all daily progress records for this project
    const dailyProgressRecords = await db.collection<DailyProgressDocument>('dailyprogresses')
      .find({ project: new ObjectId(projectId) })
      .toArray();

    if (dailyProgressRecords.length === 0) {
      return 0;
    }

    // Calculate total activities and completed activities across all days
    let totalActivities = 0;
    let completedActivities = 0;

    dailyProgressRecords.forEach(record => {
      totalActivities += record.summary.totalActivities || 0;
      completedActivities += record.summary.completed || 0;
    });

    // Calculate progress percentage
    const progressPercentage = totalActivities > 0 
      ? Math.round((completedActivities / totalActivities) * 100)
      : 0;

    // Update project progress
    await db.collection<ProjectDocument>('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { 
        $set: { 
          progress: progressPercentage,
          updatedAt: new Date()
        } 
      }
    );

    return progressPercentage;
  } catch (error) {
    console.error('Error updating project progress:', error);
    throw error;
  }
}

/**
 * Send notification to client about task status change
 */
export async function notifyClientOfTaskCompletion(
  projectId: string,
  activityTitle: string,
  managerId: string
): Promise<void> {
  try {
    const { db } = await connectToDatabase();

    // Get project details including client
    const project = await db.collection<ProjectDocument>('projects')
      .findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      throw new Error('Project not found');
    }

    // Create notification for client
    const notification = {
      recipientId: project.client,
      senderId: new ObjectId(managerId),
      type: 'task_completed',
      title: 'Task Completed',
      message: `Activity "${activityTitle}" has been completed in project "${project.title}"`,
      data: {
        projectId: projectId,
        activityTitle: activityTitle,
        url: `/client/projects/${projectId}/schedule`
      },
      isRead: false,
      priority: 'medium',
      category: 'success',
      actionRequired: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('notifications').insertOne(notification);
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

/**
 * Send notification about progress update
 */
export async function notifyClientOfProgressUpdate(
  projectId: string,
  newProgress: number,
  managerId: string
): Promise<void> {
  try {
    const { db } = await connectToDatabase();

    // Get project details
    const project = await db.collection<ProjectDocument>('projects')
      .findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      throw new Error('Project not found');
    }

    // Only send notification if progress increased significantly (every 10%)
    const progressMilestone = Math.floor(newProgress / 10) * 10;
    const oldProgressMilestone = Math.floor(project.progress / 10) * 10;

    if (progressMilestone > oldProgressMilestone) {
      const notification = {
        recipientId: project.client,
        senderId: new ObjectId(managerId),
        type: 'project_updated',
        title: 'Project Progress Update',
        message: `Project "${project.title}" is now ${newProgress}% complete`,
        data: {
          projectId: projectId,
          progress: newProgress,
          url: `/client/projects/${projectId}`
        },
        isRead: false,
        priority: 'medium',
        category: 'info',
        actionRequired: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('notifications').insertOne(notification);
    }
  } catch (error) {
    console.error('Error sending progress notification:', error);
  }
}

/**
 * Check if user is a manager of the project
 */
export async function isProjectManager(projectId: string, userId: string): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();

    const project = await db.collection<ProjectDocument>('projects')
      .findOne({ 
        _id: new ObjectId(projectId),
        managers: new ObjectId(userId)
      });

    return project !== null;
  } catch (error) {
    console.error('Error checking project manager:', error);
    return false;
  }
}

/**
 * Get all managers for a project
 */
export async function getProjectManagers(projectId: string): Promise<ObjectId[]> {
  try {
    const { db } = await connectToDatabase();

    const project = await db.collection<ProjectDocument>('projects')
      .findOne({ _id: new ObjectId(projectId) });

    return project?.managers || [];
  } catch (error) {
    console.error('Error getting project managers:', error);
    return [];
  }
}