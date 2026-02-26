// src/app/api/messages/[id]/read/route.ts - Mark Message as Read
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface MessageReadProps {
  params: Promise<{ id: string }>;
}

// PUT /api/messages/[id]/read - Mark message as read
export async function PUT(
  request: NextRequest,
  { params }: MessageReadProps
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
        error: 'Invalid message ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('messages').updateOne(
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
        error: 'Message not found or access denied' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Message marked as read' }
    });

  } catch (error: unknown) {
    console.error('Error marking message as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}