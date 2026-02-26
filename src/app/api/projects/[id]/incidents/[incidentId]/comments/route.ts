import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
    incidentId: string;
  }>;
}

interface CommentData {
  _id: ObjectId;
  userId: ObjectId;
  userName: string;
  userRole: string;
  content: string;
  createdAt: Date;
}

interface IncidentDocument {
  _id: ObjectId;
  projectId: ObjectId;
  comments?: CommentData[];
  updatedAt?: Date;
}

// POST /api/projects/[id]/incidents/[incidentId]/comments - Add comment to incident
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const params = await context.params;
    const { id: projectId, incidentId } = params;

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(incidentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Comment content is required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify incident exists and user has access
    const incident = await db.collection('incidents').findOne({
      _id: new ObjectId(incidentId),
      projectId: new ObjectId(projectId)
    });

    if (!incident) {
      return NextResponse.json({
        success: false,
        error: 'Incident not found'
      }, { status: 404 });
    }

    // Verify project access
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 });
    }

    // Check access
    const hasAccess = 
      session.user.role === 'super_admin' ||
      (session.user.role === 'project_manager' && project.manager.equals(new ObjectId(session.user.id))) ||
      (session.user.role === 'client' && project.client.equals(new ObjectId(session.user.id)));

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    const comment: CommentData = {
      _id: new ObjectId(),
      userId: new ObjectId(session.user.id),
      userName: session.user.name || 'Unknown User',
      userRole: session.user.role,
      content: content.trim(),
      createdAt: new Date()
    };

    const incidentsCollection = db.collection<IncidentDocument>('incidents');

    await incidentsCollection.updateOne(
      { _id: new ObjectId(incidentId) },
      {
        $push: { comments: comment },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        _id: comment._id.toString(),
        userId: comment.userId.toString(),
        userName: comment.userName,
        userRole: comment.userRole,
        content: comment.content,
        createdAt: comment.createdAt.toISOString()
      },
      message: 'Comment added successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error adding comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}