// src/app/api/messages/route.ts - Fixed TypeScript Issues
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, WithId, Document } from 'mongodb';

interface MessageDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  senderId: ObjectId;
  recipientId?: ObjectId;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments: MessageAttachment[];
  isRead: boolean;
  readAt?: Date;
  editedAt?: Date;
  replyTo?: ObjectId;
  reactions: MessageReaction[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageAttachment {
  fileId: ObjectId;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
}

interface MessageReaction {
  userId: ObjectId;
  emoji: string;
  createdAt: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
}

// GET /api/messages - Retrieve messages for a project or conversation
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
    const projectId = searchParams.get('projectId');
    const recipientId = searchParams.get('recipientId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify user has access to project - Fixed null check
    const project: WithId<Document> | null = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) }
      ]
    });

    if (!project && session.user.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Access denied to project messages'
      }, { status: 403 });
    }

    // Build query with proper typing
    interface QueryFilter {
      projectId: ObjectId;
      isDeleted: boolean;
      $or?: Array<{
        senderId: ObjectId;
        recipientId?: ObjectId;
      }>;
      isRead?: boolean;
      recipientId?: ObjectId;
    }

    const query: QueryFilter = {
      projectId: new ObjectId(projectId),
      isDeleted: false
    };

    // For direct messages
    if (recipientId) {
      query.$or = [
        { 
          senderId: new ObjectId(session.user.id),
          recipientId: new ObjectId(recipientId)
        },
        { 
          senderId: new ObjectId(recipientId),
          recipientId: new ObjectId(session.user.id)
        }
      ];
    }

    // For unread messages only
    if (unreadOnly) {
      query.isRead = false;
      query.recipientId = new ObjectId(session.user.id);
    }

    // Get messages with sender and recipient info
    const messages = await db.collection('messages')
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
          $lookup: {
            from: 'users',
            localField: 'recipientId',
            foreignField: '_id',
            as: 'recipient',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'files',
            localField: 'attachments.fileId',
            foreignField: '_id',
            as: 'attachmentFiles'
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$sender', 0] },
            recipient: { $arrayElemAt: ['$recipient', 0] },
            attachments: {
              $map: {
                input: '$attachments',
                as: 'attachment',
                in: {
                  $mergeObjects: [
                    '$$attachment',
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$attachmentFiles',
                            cond: { $eq: ['$$this._id', '$$attachment.fileId'] }
                          }
                        },
                        0
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    // Get total count for pagination
    const total = await db.collection('messages').countDocuments(query);

    // Get unread count for current user
    const unreadCount = await db.collection('messages').countDocuments({
      projectId: new ObjectId(projectId),
      recipientId: new ObjectId(session.user.id),
      isRead: false,
      isDeleted: false
    });

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.reverse(),
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
    console.error('Error fetching messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json() as {
      projectId: string;
      recipientId?: string;
      content: string;
      messageType?: 'text' | 'image' | 'file' | 'audio' | 'video';
      attachments?: Array<{ fileId: string }>;
      replyTo?: string;
    };

    const { projectId, recipientId, content, messageType = 'text', attachments = [], replyTo } = body;

    if (!projectId || !content?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Project ID and content are required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify user has access to project - Fixed null check
    const project: WithId<ProjectDocument> | null = await db.collection<ProjectDocument>('projects').findOne({
      _id: new ObjectId(projectId),
      $or: [
        { client: new ObjectId(session.user.id) },
        { manager: new ObjectId(session.user.id) }
      ]
    });

    if (!project && session.user.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Access denied to project'
      }, { status: 403 });
    }

    // Validate attachments if provided
    let validatedAttachments: MessageAttachment[] = [];
    if (attachments.length > 0) {
      const fileIds = attachments.map((att) => new ObjectId(att.fileId));
      const files = await db.collection('files').find({
        _id: { $in: fileIds },
        projectId: new ObjectId(projectId)
      }).toArray();

      validatedAttachments = files.map(file => ({
        fileId: file._id,
        filename: file.filename,
        originalName: file.originalName,
        url: file.url,
        mimeType: file.mimeType,
        size: file.size
      }));
    }

    // Create message document
    const messageData: MessageDocument = {
      projectId: new ObjectId(projectId),
      senderId: new ObjectId(session.user.id),
      recipientId: recipientId ? new ObjectId(recipientId) : undefined,
      content: content.trim(),
      messageType,
      attachments: validatedAttachments,
      isRead: false,
      replyTo: replyTo ? new ObjectId(replyTo) : undefined,
      reactions: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('messages').insertOne(messageData);

    // Get the created message with populated fields
    const createdMessage = await db.collection('messages')
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
          $lookup: {
            from: 'users',
            localField: 'recipientId',
            foreignField: '_id',
            as: 'recipient',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            sender: { $arrayElemAt: ['$sender', 0] },
            recipient: { $arrayElemAt: ['$recipient', 0] }
          }
        }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: createdMessage[0],
      message: 'Message sent successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

