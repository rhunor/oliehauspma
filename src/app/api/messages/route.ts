// src/app/api/messages/route.ts - FIXED WITH PROPER VALIDATION
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { validateMessagePermission } from '@/lib/messaging-permissions';

// Define proper TypeScript interfaces
interface MessageDocument {
  _id: ObjectId;
  content: string;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  isRead: boolean;
  isDeleted: boolean;
  messageType: 'text' | 'file' | 'system';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
}

interface MessageWithUsers {
  _id: ObjectId;
  content: string;
  sender: UserDocument;
  recipient: UserDocument;
  project?: ProjectDocument;
  isRead: boolean;
  messageType: 'text' | 'file' | 'system';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  createdAt: Date;
}

interface CreateMessageData {
  recipientId: string;
  content: string;
  messageType?: 'text' | 'file' | 'system';
  projectId?: string;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
}

// GET /api/messages - Get messages between current user and a participant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participantId');

    if (!participantId) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(participantId)) {
      return NextResponse.json({ error: 'Invalid participant ID' }, { status: 400 });
    }

    // Validate if user can message this participant
    const canMessage = await validateMessagePermission(
      session.user.id,
      session.user.role,
      participantId
    );

    if (!canMessage) {
      return NextResponse.json({ error: 'Not authorized to message this user' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);
    const participantObjectId = new ObjectId(participantId);

    // Build query to get messages between current user and participant
    const messagesQuery: Filter<MessageDocument> = {
      $or: [
        { senderId: currentUserId, recipientId: participantObjectId },
        { senderId: participantObjectId, recipientId: currentUserId }
      ],
      isDeleted: false
    };

    // Get messages with user and project details
    const messages = await db.collection<MessageDocument>('messages')
      .aggregate<MessageWithUsers>([
        { $match: messagesQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recipientId',
            foreignField: '_id',
            as: 'recipientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] },
            recipient: { $arrayElemAt: ['$recipientData', 0] },
            project: { $arrayElemAt: ['$projectData', 0] }
          }
        },
        { $unset: ['senderData', 'recipientData', 'projectData'] },
        { $sort: { createdAt: 1 } },
        { $limit: 100 }
      ])
      .toArray();

    // Convert to client-compatible format
    const clientMessages = messages.map(message => ({
      _id: message._id.toString(),
      content: message.content,
      sender: {
        _id: message.sender._id.toString(),
        name: message.sender.name,
        role: message.sender.role
      },
      recipient: {
        _id: message.recipient._id.toString(),
        name: message.recipient.name,
        role: message.recipient.role
      },
      project: message.project ? {
        _id: message.project._id.toString(),
        title: message.project.title
      } : undefined,
      createdAt: message.createdAt.toISOString(),
      isRead: message.isRead,
      messageType: message.messageType,
      attachments: message.attachments
    }));

    return NextResponse.json({
      success: true,
      messages: clientMessages
    });

  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateMessageData;
    const { recipientId, content, messageType = 'text', projectId, attachments } = body;

    // Validate required fields
    if (!recipientId || !content?.trim()) {
      return NextResponse.json({ error: 'Recipient ID and content are required' }, { status: 400 });
    }

    // Validate ObjectId formats
    if (!ObjectId.isValid(recipientId)) {
      return NextResponse.json({ error: 'Invalid recipient ID' }, { status: 400 });
    }

    if (projectId && !ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Validate message permission
    const canMessage = await validateMessagePermission(
      session.user.id,
      session.user.role,
      recipientId,
      projectId
    );

    if (!canMessage) {
      return NextResponse.json({ error: 'Not authorized to message this user' }, { status: 403 });
    }

    const { db } = await connectToDatabase();

    // Verify recipient exists and is active
    const recipient = await db.collection('users').findOne(
      { _id: new ObjectId(recipientId) },
      { projection: { isActive: 1 } }
    );

    if (!recipient || !recipient.isActive) {
      return NextResponse.json({ error: 'Recipient not found or inactive' }, { status: 404 });
    }

    // Create message document
    const newMessage: Omit<MessageDocument, '_id'> = {
      content: content.trim(),
      senderId: new ObjectId(session.user.id),
      recipientId: new ObjectId(recipientId),
      projectId: projectId ? new ObjectId(projectId) : undefined,
      isRead: false,
      isDeleted: false,
      messageType,
      attachments: attachments || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert message
    const result = await db.collection('messages').insertOne(newMessage);

    // Get the created message with user details
    const createdMessage = await db.collection<MessageDocument>('messages')
      .aggregate<MessageWithUsers>([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recipientId',
            foreignField: '_id',
            as: 'recipientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectData',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] },
            recipient: { $arrayElemAt: ['$recipientData', 0] },
            project: { $arrayElemAt: ['$projectData', 0] }
          }
        },
        { $unset: ['senderData', 'recipientData', 'projectData'] }
      ])
      .toArray();

    if (createdMessage.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve created message' }, { status: 500 });
    }

    const message = createdMessage[0];

    // Convert to client-compatible format
    const clientMessage = {
      _id: message._id.toString(),
      content: message.content,
      sender: {
        _id: message.sender._id.toString(),
        name: message.sender.name,
        role: message.sender.role
      },
      recipient: {
        _id: message.recipient._id.toString(),
        name: message.recipient.name,
        role: message.recipient.role
      },
      project: message.project ? {
        _id: message.project._id.toString(),
        title: message.project.title
      } : undefined,
      createdAt: message.createdAt.toISOString(),
      isRead: message.isRead,
      messageType: message.messageType,
      attachments: message.attachments
    };

    return NextResponse.json({
      success: true,
      message: clientMessage
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}