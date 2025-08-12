// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { z } from 'zod';

// Define interfaces for MongoDB documents
interface NotificationDocument {
  _id?: ObjectId;
  recipient: ObjectId;
  sender?: ObjectId;
  type: string;
  title: string;
  message: string;
  data?: {
    projectId?: ObjectId;
    taskId?: ObjectId;
    messageId?: ObjectId;
    fileId?: ObjectId;
    url?: string;
    metadata?: unknown;
  };
  isRead: boolean;
  priority: string;
  category: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  isActive: boolean;
  password?: string;
}

// Define aggregation result types
interface NotificationWithSender extends Omit<NotificationDocument, 'sender'> {
  sender: Omit<UserDocument, 'password'> | null;
}

interface NotificationMatchQuery extends Filter<NotificationDocument> {
  recipient: ObjectId;
  isRead?: boolean;
}

const createNotificationSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  senderId: z.string().optional(),
  type: z.enum([
    'task_assigned',
    'task_completed', 
    'task_updated',
    'project_updated',
    'milestone_reached',
    'deadline_approaching',
    'message_received',
    'file_uploaded',
    'user_mentioned',
    'project_invitation',
    'comment_added'
  ]),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  message: z.string().min(1, 'Message is required').max(500, 'Message must be less than 500 characters'),
  data: z.object({
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    messageId: z.string().optional(),
    fileId: z.string().optional(),
    url: z.string().optional(),
    metadata: z.unknown().optional()
  }).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  expiresAt: z.string().datetime().optional()
});

// GET /api/notifications?page=1&limit=20&unreadOnly=false
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const skip = (page - 1) * limit;

    const { db } = await connectToDatabase();

    const matchQuery: NotificationMatchQuery = {
      recipient: new ObjectId(session.user.id)
    };

    if (unreadOnly) {
      matchQuery.isRead = false;
    }

    // Get notifications with pagination
    const notifications = await db.collection<NotificationDocument>('notifications')
      .aggregate<NotificationWithSender>([
        { $match: matchQuery },
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
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] }
          }
        },
        { $unset: ['senderData'] },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ])
      .toArray();

    // Get unread count
    const unreadCount = await db.collection<NotificationDocument>('notifications').countDocuments({
      recipient: new ObjectId(session.user.id),
      isRead: false
    });

    // Get total count
    const totalCount = await db.collection<NotificationDocument>('notifications').countDocuments(matchQuery);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
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
    console.error('Error fetching notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/notifications
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createNotificationSchema.safeParse(body);

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

    const notificationData = validation.data;
    const { db } = await connectToDatabase();

    // Verify recipient exists
    const recipient = await db.collection<UserDocument>('users').findOne({
      _id: new ObjectId(notificationData.recipientId),
      isActive: true
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Create notification
    const newNotification: NotificationDocument = {
      recipient: new ObjectId(notificationData.recipientId),
      sender: notificationData.senderId ? new ObjectId(notificationData.senderId) : new ObjectId(session.user.id),
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data ? {
        ...(notificationData.data.projectId && { projectId: new ObjectId(notificationData.data.projectId) }),
        ...(notificationData.data.taskId && { taskId: new ObjectId(notificationData.data.taskId) }),
        ...(notificationData.data.messageId && { messageId: new ObjectId(notificationData.data.messageId) }),
        ...(notificationData.data.fileId && { fileId: new ObjectId(notificationData.data.fileId) }),
        url: notificationData.data.url,
        metadata: notificationData.data.metadata
      } : {},
      isRead: false,
      priority: notificationData.priority,
      category: notificationData.category,
      ...(notificationData.expiresAt && { expiresAt: new Date(notificationData.expiresAt) }),
      createdAt: new Date()
    };

    const result = await db.collection<NotificationDocument>('notifications').insertOne(newNotification);

    // Get the created notification with populated sender data
    const createdNotification = await db.collection<NotificationDocument>('notifications')
      .aggregate<NotificationWithSender>([
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
          $addFields: {
            sender: { $arrayElemAt: ['$senderData', 0] }
          }
        },
        { $unset: ['senderData'] }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: createdNotification[0],
      message: 'Notification created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}