// src/app/api/notifications/route.ts - Notifications API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface NotificationDocument {
  _id?: ObjectId;
  recipientId: ObjectId;
  senderId?: ObjectId;
  type: 'task_assigned' | 'task_completed' | 'project_updated' | 'milestone_reached' | 
        'deadline_approaching' | 'message_received' | 'file_uploaded' | 'user_mentioned' |
        'project_created' | 'project_status_changed' | 'comment_added';
  title: string;
  message: string;
  data?: {
    projectId?: string;
    taskId?: string;
    messageId?: string;
    fileId?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  isRead: boolean;
  readAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'info' | 'success' | 'warning' | 'error';
  expiresAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/notifications - Retrieve user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');

    const { db } = await connectToDatabase();

    // Build query
    const query: Record<string, unknown> = {
      recipientId: new ObjectId(session.user.id),
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    if (priority) {
      query.priority = priority;
    }

    if (category) {
      query.category = category;
    }

    // Get notifications with sender info
    const notifications = await db.collection('notifications')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'sender',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$sender', 0] }
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    // Get total count and unread count
    const total = await db.collection('notifications').countDocuments(query);
    const unreadCount = await db.collection('notifications').countDocuments({
      recipientId: new ObjectId(session.user.id),
      isRead: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        unreadCount
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/notifications - Create notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      recipientId, 
      type, 
      title, 
      message, 
      data, 
      priority = 'medium',
      category = 'info',
      expiresAt,
      actionRequired = false,
      actionUrl
    } = body;

    if (!recipientId || !type || !title || !message) {
      return NextResponse.json({
        success: false,
        error: 'recipientId, type, title, and message are required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify recipient exists
    const recipient = await db.collection('users').findOne({
      _id: new ObjectId(recipientId),
      isActive: true
    });

    if (!recipient) {
      return NextResponse.json({
        success: false,
        error: 'Recipient not found or inactive'
      }, { status: 404 });
    }

    // Create notification
    const notificationData: NotificationDocument = {
      recipientId: new ObjectId(recipientId),
      senderId: new ObjectId(session.user.id),
      type,
      title,
      message,
      data,
      isRead: false,
      priority,
      category,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      actionRequired,
      actionUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('notifications').insertOne(notificationData);

    // Get created notification with sender info
    const createdNotification = await db.collection('notifications')
      .aggregate([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'sender',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$sender', 0] }
          }
        }
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
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}