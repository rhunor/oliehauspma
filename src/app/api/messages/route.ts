// src/app/api/messages/route.ts - FIXED MESSAGES API WITH PROPER TYPES
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define proper TypeScript interfaces
interface MessageDocument {
  _id: ObjectId;
  content: string;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  messageType: 'text' | 'file' | 'system';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Use this for insertOne - MongoDB will auto-generate _id
interface MessageInsertDocument {
  content: string;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  messageType: 'text' | 'file' | 'system';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
}

interface MessageWithUsers extends Omit<MessageDocument, 'senderId' | 'recipientId' | 'projectId'> {
  sender: UserDocument;
  recipient: UserDocument;
  project?: ProjectDocument;
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
      attachments: message.attachments || []
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

    if (!recipientId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Recipient ID and content are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify recipient exists
    const recipient = await db.collection<UserDocument>('users').findOne({
      _id: new ObjectId(recipientId),
      isActive: true
    });

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found or inactive' },
        { status: 404 }
      );
    }

    // Check if users are allowed to message each other based on roles
    const senderRole = session.user.role;
    const recipientRole = recipient.role;
    
    const allowedCommunication = [
      ['super_admin', 'project_manager'],
      ['super_admin', 'client'],
      ['project_manager', 'client']
    ];

    const canCommunicate = allowedCommunication.some(([role1, role2]) => 
      (senderRole === role1 && recipientRole === role2) ||
      (senderRole === role2 && recipientRole === role1)
    );

    if (!canCommunicate) {
      return NextResponse.json(
        { error: 'You are not allowed to message this user' },
        { status: 403 }
      );
    }

    // Create message document for insertion
    const messageDoc: MessageInsertDocument = {
      content: content.trim(),
      senderId: new ObjectId(session.user.id),
      recipientId: new ObjectId(recipientId),
      projectId: projectId ? new ObjectId(projectId) : undefined,
      messageType,
      attachments: attachments || [],
      isRead: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<MessageInsertDocument>('messages').insertOne(messageDoc);

    // Get the created message with user details
    const newMessage = await db.collection<MessageDocument>('messages')
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

    const message = newMessage[0];
    if (!message) {
      throw new Error('Failed to retrieve created message');
    }

    return NextResponse.json({
      success: true,
      message: {
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
        attachments: message.attachments || []
      }
    });

  } catch (error: unknown) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}