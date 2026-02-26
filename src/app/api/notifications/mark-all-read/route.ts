// src/app/api/notifications/mark-all-read/route.ts - Mark All Notifications as Read
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// PUT /api/notifications/mark-all-read - Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('notifications').updateMany(
      { 
        recipientId: new ObjectId(session.user.id),
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
      data: { 
        message: 'All notifications marked as read',
        updatedCount: result.modifiedCount
      }
    });

  } catch (error: unknown) {
    console.error('Error marking all notifications as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

