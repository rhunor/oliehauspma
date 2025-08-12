// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// PATCH /api/notifications/[id] - Mark notification as read/unread
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await the params Promise in Next.js 15
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
    }

    const body = await request.json();
    const { isRead } = body;

    if (typeof isRead !== 'boolean') {
      return NextResponse.json({ error: 'isRead must be a boolean' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Update notification only if it belongs to the authenticated user
    const result = await db.collection('notifications').updateOne(
      { 
        _id: new ObjectId(id),
        recipient: new ObjectId(session.user.id)
      },
      { 
        $set: { 
          isRead,
          ...(isRead && { readAt: new Date() })
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Notification marked as ${isRead ? 'read' : 'unread'}`
    });

  } catch (error: unknown) {
    console.error('Error updating notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/notifications/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await the params Promise in Next.js 15
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Delete notification only if it belongs to the authenticated user
    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(id),
      recipient: new ObjectId(session.user.id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}