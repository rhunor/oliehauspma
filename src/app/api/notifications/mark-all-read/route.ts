// src/app/api/notifications/mark-all-read/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function PUT() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();

    // Mark all unread notifications as read for the current user
    const result = await db.collection('notifications').updateMany(
      { 
        recipient: new ObjectId(session.user.id),
        isRead: false
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        } 
      }
    );

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });

  } catch (error: unknown) {
    console.error('Error marking all notifications as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}