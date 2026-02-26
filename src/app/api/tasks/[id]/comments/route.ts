// src/app/api/tasks/[id]/comments/route.ts - ENHANCED COMMENTS API (FIXED)
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Import our enhanced comment types
import type { TaskComment } from '@/lib/types/comments';

// Enhanced comment validation schema
interface CreateCommentRequest {
  content: string;
  isInternal?: boolean;
  mentions?: string[];
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  parentCommentId?: string;
}

// Interface for route params
interface CommentRouteParams {
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

// GET /api/tasks/[id]/comments - Get task comments with threading
export async function GET(
  request: NextRequest,
  { params }: CommentRouteParams
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
        error: 'Invalid task ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this task
    const taskFilter: Filter<Record<string, unknown>> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      // Get client's projects first
      const clientProjects = await db.collection('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = clientProjects.map(p => p._id);
      taskFilter.projectId = { $in: projectIds };
    } else if (session.user.role === 'project_manager') {
      // Get manager's projects first
      const managerProjects = await db.collection('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = managerProjects.map(p => p._id);
      taskFilter.projectId = { $in: projectIds };
    }

    const task = await db.collection('tasks').findOne(taskFilter);
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found or access denied' 
      }, { status: 404 });
    }

    // Get all comments for this task
    const comments = await db.collection<CommentDocument>('comments')
      .find({ taskId: new ObjectId(id) })
      .sort({ createdAt: 1 })
      .toArray();

    // Get all comment authors
    const authorIds = [...new Set(comments.map(c => c.authorId.toString()))];
    const authors = await db.collection('users')
      .find({ _id: { $in: authorIds.map(id => new ObjectId(id)) } })
      .project({ name: 1, role: 1, avatar: 1 })
      .toArray();

    // Transform comments with author details and threading
    const transformedComments: TaskComment[] = comments.map(comment => {
      const author = authors.find(a => a._id.toString() === comment.authorId.toString());
      
      return {
        _id: comment._id!.toString(),
        taskId: comment.taskId.toString(),
        content: comment.content,
        authorId: comment.authorId.toString(),
        authorName: author?.name || 'Unknown User',
        authorRole: (author?.role as 'client' | 'project_manager' | 'super_admin') || 'client',
        isInternal: comment.isInternal,
        mentions: comment.mentions?.map(m => m.toString()) || [],
        attachments: comment.attachments || [],
        parentCommentId: comment.parentCommentId?.toString(),
        edited: comment.edited,
        editedAt: comment.editedAt?.toISOString(),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString()
      };
    });

    // Filter internal comments for clients
    const filteredComments = session.user.role === 'client' 
      ? transformedComments.filter(c => !c.isInternal)
      : transformedComments;

    // Organize into threads
    const topLevelComments = filteredComments.filter(c => !c.parentCommentId);
    const commentThreads = topLevelComments.map(comment => {
      const replies = filteredComments.filter(c => c.parentCommentId === comment._id);
      return {
        comment,
        replies,
        replyCount: replies.length
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        comments: filteredComments,
        threads: commentThreads,
        totalCount: filteredComments.length
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching task comments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// POST /api/tasks/[id]/comments - Add enhanced comment to task
export async function POST(
  request: NextRequest,
  { params }: CommentRouteParams
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
        error: 'Invalid task ID' 
      }, { status: 400 });
    }

    const body: CreateCommentRequest = await request.json();
    
    // Validate content
    if (!body.content || body.content.trim().length < 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment content is required' 
      }, { status: 400 });
    }

    if (body.content.length > 1000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment content must be less than 1000 characters' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this task
    const taskFilter: Filter<Record<string, unknown>> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      const clientProjects = await db.collection('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = clientProjects.map(p => p._id);
      taskFilter.projectId = { $in: projectIds };
    } else if (session.user.role === 'project_manager') {
      const managerProjects = await db.collection('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = managerProjects.map(p => p._id);
      taskFilter.projectId = { $in: projectIds };
    }

    const task = await db.collection('tasks').findOne(taskFilter);
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found or access denied' 
      }, { status: 404 });
    }

    // Validate parent comment if provided
    if (body.parentCommentId) {
      if (!ObjectId.isValid(body.parentCommentId)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid parent comment ID' 
        }, { status: 400 });
      }

      const parentComment = await db.collection('comments').findOne({
        _id: new ObjectId(body.parentCommentId),
        taskId: new ObjectId(id)
      });

      if (!parentComment) {
        return NextResponse.json({ 
          success: false, 
          error: 'Parent comment not found' 
        }, { status: 404 });
      }
    }

    // Validate mentions if provided
    let mentionIds: ObjectId[] = [];
    if (body.mentions && body.mentions.length > 0) {
      // Validate mention user IDs
      const validMentions = body.mentions.filter(mention => ObjectId.isValid(mention));
      if (validMentions.length > 0) {
        mentionIds = validMentions.map(mention => new ObjectId(mention));
        
        // Verify mentioned users exist
        const mentionedUsers = await db.collection('users')
          .find({ _id: { $in: mentionIds } })
          .toArray();
        
        mentionIds = mentionedUsers.map(user => user._id);
      }
    }

    // Get user details for response
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { name: 1, role: 1, avatar: 1 } }
    );

    // Create comment document
    const commentDoc: CommentDocument = {
      taskId: new ObjectId(id),
      content: body.content.trim(),
      authorId: userId,
      isInternal: body.isInternal || false,
      mentions: mentionIds.length > 0 ? mentionIds : undefined,
      attachments: body.attachments || [],
      parentCommentId: body.parentCommentId ? new ObjectId(body.parentCommentId) : undefined,
      edited: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert comment
    const result = await db.collection<CommentDocument>('comments').insertOne(commentDoc);

    // Transform for response
    const responseComment: TaskComment = {
      _id: result.insertedId.toString(),
      taskId: commentDoc.taskId.toString(),
      content: commentDoc.content,
      authorId: commentDoc.authorId.toString(),
      authorName: user?.name || 'Unknown User',
      authorRole: (user?.role as 'client' | 'project_manager' | 'super_admin') || 'client',
      isInternal: commentDoc.isInternal,
      mentions: commentDoc.mentions?.map(m => m.toString()) || [],
      attachments: commentDoc.attachments || [],
      parentCommentId: commentDoc.parentCommentId?.toString(),
      edited: commentDoc.edited,
      editedAt: commentDoc.editedAt?.toISOString(),
      createdAt: commentDoc.createdAt.toISOString(),
      updatedAt: commentDoc.updatedAt.toISOString()
    };

    // TODO: Send notifications to mentioned users
    if (mentionIds.length > 0) {
      // This would integrate with your notification system
      console.log('Sending notifications to mentioned users:', mentionIds);
    }

    // Update task's last activity
    await db.collection('tasks').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          updatedAt: new Date(),
          lastCommentAt: new Date()
        },
        $inc: { commentCount: 1 }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        comment: responseComment,
        message: 'Comment added successfully'
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error adding task comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}