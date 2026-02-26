// src/app/api/messages/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface MarkReadRequest {
  participantId: string;
}

// POST /api/messages/mark-read - Mark messages as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as MarkReadRequest;
    const { participantId } = body;

    if (!participantId || !ObjectId.isValid(participantId)) {
      return NextResponse.json({ error: 'Valid participant ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);
    const participantObjectId = new ObjectId(participantId);

    // Mark all messages from the participant as read
    const result = await db.collection('messages').updateMany(
      {
        senderId: participantObjectId,
        recipientId: currentUserId,
        isRead: false,
        isDeleted: false
      },
      {
        $set: {
          isRead: true,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      markedCount: result.modifiedCount
    });

  } catch (error: unknown) {
    console.error('Error marking messages as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}