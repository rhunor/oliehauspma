// src/app/api/projects/[id]/comment-activity/route.ts - Get recent comment activity for project
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Interface for route params
interface ProjectCommentActivityParams {
  params: Promise<{
    id: string;
  }>;
}

// Enhanced comment document for MongoDB
interface CommentDocument {
  _id?: ObjectId;
  taskId: ObjectId;
  content: string;
  authorId: ObjectId;
  isInternal: boolean;
  mentions?: ObjectId[];
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  parentCommentId?: ObjectId;
  edited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/projects/[id]/comment-activity - Get recent comment activity for project
export async function GET(
  request: NextRequest,
  { params }: ProjectCommentActivityParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid project ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check project access
    const projectFilter: Filter<Record<string, unknown>> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      projectFilter.client = userId;
    } else if (session.user.role === 'project_manager') {
      projectFilter.manager = userId;
    }

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Get project tasks
    const tasks = await db.collection('tasks')
      .find({ projectId: new ObjectId(id) })
      .project({ _id: 1, title: 1 })
      .toArray();

    const taskIds = tasks.map(t => t._id);

    // Get recent comments
    const comments = await db.collection<CommentDocument>('comments')
      .find({ 
        taskId: { $in: taskIds },
        ...(session.user.role === 'client' ? { isInternal: false } : {})
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Get comment authors
    const authorIds = [...new Set(comments.map(c => c.authorId.toString()))];
    const authors = await db.collection('users')
      .find({ _id: { $in: authorIds.map(id => new ObjectId(id)) } })
      .project({ name: 1, role: 1 })
      .toArray();

    // Transform comments with task and author details
    const recentActivity = comments.map(comment => {
      const task = tasks.find(t => t._id.equals(comment.taskId));
      const author = authors.find(a => a._id.toString() === comment.authorId.toString());
      
      return {
        _id: comment._id!.toString(),
        content: comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content,
        authorName: author?.name || 'Unknown User',
        authorRole: author?.role || 'unknown',
        taskId: comment.taskId.toString(),
        taskTitle: task?.title || 'Unknown Task',
        isInternal: comment.isInternal,
        createdAt: comment.createdAt.toISOString()
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        recentActivity,
        totalComments: comments.length
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching project comment activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}