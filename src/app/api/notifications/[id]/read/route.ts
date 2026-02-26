// src/app/api/notifications/[id]/read/route.ts - Mark Notification as Read
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface NotificationReadProps {
  params: Promise<{ id: string }>;
}

// PUT /api/notifications/[id]/read - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: NotificationReadProps
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
        error: 'Invalid notification ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('notifications').updateOne(
      { 
        _id: new ObjectId(id),
        recipientId: new ObjectId(session.user.id)
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Notification not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Notification marked as read' }
    });

  } catch (error: unknown) {
    console.error('Error marking notification as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

