// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const createMessageSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  recipient: z.string().optional(),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message too long'),
  messageType: z.enum(['text', 'file', 'image', 'system']).default('text'),
  attachments: z.array(z.object({
    filename: z.string(),
    originalName: z.string(),
    size: z.number(),
    mimeType: z.string(),
    url: z.string()
  })).optional()
});

// GET /api/messages?projectId=xxx&page=1&limit=50
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify user has access to this project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) },
        ...(session.user.role === 'super_admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Get messages with pagination
    const messages = await db.collection('messages')
      .aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            isDeleted: { $ne: true }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'sender',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recipient',
            foreignField: '_id',
            as: 'recipientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] },
            recipient: { $arrayElemAt: ['$recipientData', 0] }
          }
        },
        { $unset: ['senderData', 'recipientData'] },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('messages').countDocuments({
      projectId: new ObjectId(projectId),
      isDeleted: { $ne: true }
    });

    return NextResponse.json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/messages
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const messageData = validation.data;
    const { db } = await connectToDatabase();

    // Verify user has access to this project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(messageData.projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) },
        ...(session.user.role === 'super_admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Verify sender is the authenticated user
    if (messageData.senderId !== session.user.id) {
      return NextResponse.json({ error: 'Cannot send message as another user' }, { status: 403 });
    }

    // If recipient is specified, verify they have access to the project
    if (messageData.recipient) {
      const recipientAccess = await db.collection('projects').findOne({
        _id: new ObjectId(messageData.projectId),
        $or: [
          { client: new ObjectId(messageData.recipient) },
          { manager: new ObjectId(messageData.recipient) }
        ]
      });

      if (!recipientAccess) {
        return NextResponse.json({ error: 'Recipient does not have access to this project' }, { status: 400 });
      }
    }

    // Create message
    const newMessage = {
      projectId: new ObjectId(messageData.projectId),
      sender: new ObjectId(messageData.senderId),
      recipient: messageData.recipient ? new ObjectId(messageData.recipient) : null,
      content: messageData.content,
      messageType: messageData.messageType,
      attachments: messageData.attachments || [],
      isRead: false,
      readBy: [],
      replyTo: null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('messages').insertOne(newMessage);

    // Get the created message with populated sender/recipient data
    const createdMessage = await db.collection('messages')
      .aggregate([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'users',
            localField: 'sender',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recipient',
            foreignField: '_id',
            as: 'recipientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] },
            recipient: { $arrayElemAt: ['$recipientData', 0] }
          }
        },
        { $unset: ['senderData', 'recipientData'] }
      ])
      .toArray();

    // Create notification for recipient (if it's a direct message)
    if (messageData.recipient && messageData.recipient !== session.user.id) {
      await db.collection('notifications').insertOne({
        recipient: new ObjectId(messageData.recipient),
        sender: new ObjectId(session.user.id),
        type: 'message_received',
        title: 'New Message',
        message: `${session.user.name} sent you a message`,
        data: {
          projectId: new ObjectId(messageData.projectId),
          messageId: result.insertedId
        },
        isRead: false,
        priority: 'medium',
        category: 'info',
        createdAt: new Date()
      });
    }

    return NextResponse.json({
      success: true,
      data: createdMessage[0],
      message: 'Message sent successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
