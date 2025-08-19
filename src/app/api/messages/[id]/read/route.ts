// src/app/api/messages/[id]/read/route.ts - Mark message as read
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const params = await context.params;
    const messageId = params.id;

    if (!ObjectId.isValid(messageId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid message ID'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Mark message as read only if user is the recipient
    const result = await db.collection('messages').updateOne(
      {
        _id: new ObjectId(messageId),
        $or: [
          { recipientId: new ObjectId(session.user.id) },
          { projectId: { $exists: true }, recipientId: { $exists: false } } // Project-wide messages
        ],
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Message not found or already read'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Message marked as read'
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