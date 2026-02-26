// src/app/api/analytics/manager/activity/route.ts - FIXED WITH PROPER TYPES
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Define activity types
interface ActivityItem {
  id: string;
  type: 'project_update' | 'task_completed' | 'message' | 'file_upload';
  message: string;
  timestamp: Date;
  projectTitle?: string;
}

// Define document structures for type safety
interface TaskDocument {
  _id: ObjectId;
  title: string;
  status: string;
  completedAt?: Date;
  updatedAt: Date;
  projectId: ObjectId;
}

interface MessageDocument {
  _id: ObjectId;
  content: string;
  sender: ObjectId;
  projectId: ObjectId;
  createdAt: Date;
}

interface FileDocument {
  _id: ObjectId;
  originalName: string;
  projectId: ObjectId;
  createdAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'project_manager') {
      return NextResponse.json(
        { error: 'Access denied - Project managers only' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { db } = await connectToDatabase();
    const managerId = new ObjectId(session.user.id);

    // Get projects managed by this manager
    const managerProjects = await db.collection<ProjectDocument>('projects')
      .find({ manager: managerId }, { projection: { _id: 1, title: 1 } })
      .toArray();

    const projectIds = managerProjects.map(p => p._id);
    const projectTitleMap = new Map(managerProjects.map(p => [p._id.toString(), p.title]));

    // Initialize activities array with proper typing
    const activities: ActivityItem[] = [];

    try {
      // Recent task completions with proper error handling
      const recentTasks = await db.collection<TaskDocument>('tasks')
        .find({
          projectId: { $in: projectIds },
          status: 'completed',
          completedAt: { $exists: true }
        })
        .sort({ completedAt: -1 })
        .limit(limit)
        .toArray();

      recentTasks.forEach(task => {
        if (task.completedAt) {
          activities.push({
            id: `task_${task._id.toString()}`,
            type: 'task_completed',
            message: `Task "${task.title}" was completed`,
            projectTitle: projectTitleMap.get(task.projectId.toString()),
            timestamp: task.completedAt
          });
        }
      });
    } catch (error) {
      console.warn('Error fetching tasks:', error);
      // Continue without tasks if collection doesn't exist
    }

    try {
      // Recent messages with proper error handling
      const recentMessages = await db.collection<MessageDocument>('chatmessages')
        .find({
          projectId: { $in: projectIds },
          sender: { $ne: managerId }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      recentMessages.forEach(message => {
        activities.push({
          id: `message_${message._id.toString()}`,
          type: 'message',
          message: 'New message received',
          projectTitle: projectTitleMap.get(message.projectId.toString()),
          timestamp: message.createdAt
        });
      });
    } catch (error) {
      console.warn('Error fetching messages:', error);
      // Continue without messages if collection doesn't exist
    }

    try {
      // Recent file uploads with proper error handling
      const recentFiles = await db.collection<FileDocument>('files')
        .find({
          projectId: { $in: projectIds }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      recentFiles.forEach(file => {
        activities.push({
          id: `file_${file._id.toString()}`,
          type: 'file_upload',
          message: `File "${file.originalName}" was uploaded`,
          projectTitle: projectTitleMap.get(file.projectId.toString()),
          timestamp: file.createdAt
        });
      });
    } catch (error) {
      console.warn('Error fetching files:', error);
      // Continue without files if collection doesn't exist
    }

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const limitedActivities = activities.slice(0, limit);

    // Transform for JSON serialization
    const serializedActivities = limitedActivities.map(activity => ({
      ...activity,
      timestamp: activity.timestamp.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: serializedActivities
    });

  } catch (error: unknown) {
    console.error('Error fetching manager activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}