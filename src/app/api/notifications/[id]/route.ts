// src/app/api/notifications/[id]/route.ts - Mark notification as read/unread
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const notificationId = params.id;

    if (!ObjectId.isValid(notificationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid notification ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const { isRead } = body;

    if (typeof isRead !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'isRead must be a boolean'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const updateData: Record<string, unknown> = {
      isRead,
      updatedAt: new Date()
    };

    if (isRead) {
      updateData.readAt = new Date();
    } else {
      updateData.$unset = { readAt: 1 };
    }

    const result = await db.collection('notifications').updateOne(
      {
        _id: new ObjectId(notificationId),
        recipientId: new ObjectId(session.user.id)
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Notification not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Notification marked as ${isRead ? 'read' : 'unread'}`
    });

  } catch (error: unknown) {
    console.error('Error updating notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const notificationId = params.id;

    if (!ObjectId.isValid(notificationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid notification ID'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(notificationId),
      recipientId: new ObjectId(session.user.id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Notification not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

