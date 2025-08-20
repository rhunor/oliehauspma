// src/app/api/tasks/[id]/comments/route.ts - Fixed MongoDB $push TypeScript Error
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { taskCommentSchema } from '@/lib/validation';
import { ObjectId, Filter, UpdateFilter } from 'mongodb';

interface TaskCommentsPageProps {
  params: Promise<{ id: string }>;
}

// Define proper interfaces for MongoDB documents
interface TaskDocument {
  _id: ObjectId;
  projectId: ObjectId;
  comments?: CommentDocument[];
  updatedAt?: Date;
}

interface CommentDocument {
  _id: ObjectId;
  content: string;
  authorId: ObjectId;
  createdAt: Date;
  isInternal: boolean;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  avatar?: string;
  role: string;
}

interface ProjectDocument {
  _id: ObjectId;
  client?: ObjectId;
  manager?: ObjectId;
}

// Aggregation result interfaces
interface TaskWithCommentsResult extends TaskDocument {
  commentAuthors?: UserDocument[];
}

interface TransformedComment {
  _id: string;
  content: string;
  authorId: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
    role: string;
  } | null;
  createdAt: string;
  isInternal: boolean;
}

// GET /api/tasks/[id]/comments - Get task comments
export async function GET(
  request: NextRequest,
  { params }: TaskCommentsPageProps
) {
  try {
    const session = await getServerSession(authOptions);
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
    const accessFilter: Filter<TaskDocument> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      const clientProjects = await db.collection<ProjectDocument>('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = clientProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    } else if (session.user.role === 'project_manager') {
      const managerProjects = await db.collection<ProjectDocument>('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = managerProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    }

    // Get task with comments using aggregation
    const taskResults = await db.collection<TaskDocument>('tasks').aggregate<TaskWithCommentsResult>([
      { $match: accessFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.authorId',
          foreignField: '_id',
          as: 'commentAuthors',
          pipeline: [{ $project: { name: 1, avatar: 1, role: 1 } }]
        }
      }
    ]).toArray();

    if (taskResults.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found or access denied' 
      }, { status: 404 });
    }

    const taskData = taskResults[0];
    
    // Transform comments with author details
    const transformedComments: TransformedComment[] = (taskData.comments || []).map((comment: CommentDocument) => {
      const author = taskData.commentAuthors?.find((a: UserDocument) => 
        a._id.toString() === comment.authorId.toString()
      );
      
      return {
        ...comment,
        _id: comment._id.toString(),
        authorId: comment.authorId.toString(),
        author: author ? {
          ...author,
          _id: author._id.toString()
        } : null,
        createdAt: comment.createdAt.toISOString()
      };
    }).sort((a: TransformedComment, b: TransformedComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: transformedComments
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

// POST /api/tasks/[id]/comments - Add comment to task
export async function POST(
  request: NextRequest,
  { params }: TaskCommentsPageProps
) {
  try {
    const session = await getServerSession(authOptions);
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

    const body = await request.json();
    
    // Validate input
    const validation = taskCommentSchema.safeParse({
      ...body,
      taskId: id
    });
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const data = validation.data;
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this task
    const accessFilter: Filter<TaskDocument> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      const clientProjects = await db.collection<ProjectDocument>('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = clientProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    } else if (session.user.role === 'project_manager') {
      const managerProjects = await db.collection<ProjectDocument>('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      const projectIds = managerProjects.map(p => p._id);
      accessFilter.projectId = { $in: projectIds };
    }

    const task = await db.collection<TaskDocument>('tasks').findOne(accessFilter);
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found or access denied' 
      }, { status: 404 });
    }

    // Create comment object
    const comment: CommentDocument = {
      _id: new ObjectId(),
      content: data.content,
      authorId: userId,
      createdAt: new Date(),
      isInternal: body.isInternal || false
    };

    // Use proper UpdateFilter type for MongoDB $push operator
    const updateOperation: UpdateFilter<TaskDocument> = {
      $push: { 
        comments: comment 
      },
      $set: { updatedAt: new Date() }
    };

    // Add comment to task
    const result = await db.collection<TaskDocument>('tasks').updateOne(
      { _id: new ObjectId(id) },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Get author details for response
    const author = await db.collection<UserDocument>('users').findOne(
      { _id: userId },
      { projection: { name: 1, avatar: 1, role: 1 } }
    );

    const responseComment: TransformedComment = {
      ...comment,
      _id: comment._id.toString(),
      authorId: comment.authorId.toString(),
      author: author ? {
        ...author,
        _id: author._id.toString()
      } : null,
      createdAt: comment.createdAt.toISOString()
    };

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