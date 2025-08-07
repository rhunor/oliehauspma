// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createNotificationSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const unreadOnly = searchParams.get('unread') === 'true';

    const { db } = await connectToDatabase();
    
    // Build filter for user's notifications
    const filter: Record<string, unknown> = {
      recipient: new ObjectId(session.user.id)
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    // Get total count
    const total = await db.collection('notifications').countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Get notifications with sender info
    const notifications = await db.collection('notifications')
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'sender',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }]
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
    const unreadCount = await db.collection('notifications').countDocuments({
      recipient: new ObjectId(session.user.id),
      isRead: false
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = createNotificationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    const notificationData = validation.data;
    const { db } = await connectToDatabase();

    // Verify recipient exists
    const recipient = await db.collection('users').findOne({ 
      _id: new ObjectId(notificationData.recipientId),
      isActive: true 
    });

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found or inactive' },
        { status: 400 }
      );
    }

    // Create notification document
    const newNotification = {
      recipient: new ObjectId(notificationData.recipientId),
      sender: notificationData.senderId ? new ObjectId(notificationData.senderId) : new ObjectId(session.user.id),
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data ? {
        projectId: notificationData.data.projectId ? new ObjectId(notificationData.data.projectId) : undefined,
        taskId: notificationData.data.taskId ? new ObjectId(notificationData.data.taskId) : undefined,
        messageId: notificationData.data.messageId ? new ObjectId(notificationData.data.messageId) : undefined,
        fileId: notificationData.data.fileId ? new ObjectId(notificationData.data.fileId) : undefined,
      } : {},
      isRead: false,
      createdAt: new Date(),
    };

    // Remove undefined fields
    if (newNotification.data) {
      Object.keys(newNotification.data).forEach((key: string) => {
        if ((newNotification.data as Record<string, unknown>)[key] === undefined) {
          delete (newNotification.data as Record<string, unknown>)[key];
        }
      });
    }

    const result = await db.collection('notifications').insertOne(newNotification);

    return NextResponse.json({
      success: true,
      data: {
        _id: result.insertedId,
        ...newNotification,
      },
      message: 'Notification created successfully',
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}