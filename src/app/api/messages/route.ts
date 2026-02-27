// src/app/api/messages/route.ts - FIXED WITH FULL TYPE SAFETY & ESLINT COMPLIANCE
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, WithId, Document, Db } from 'mongodb';

interface MessageDocument {
  _id?: ObjectId;
  projectId?: ObjectId;
  senderId: ObjectId;
  recipientId: ObjectId;
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

// Database query filter types
interface ProjectMessageFilter {
  projectId: ObjectId;
  isDeleted: boolean;
  $or: Array<{
    senderId: ObjectId;
    recipientId: ObjectId;
  }>;
  recipientId?: ObjectId;
  isRead?: boolean;
}

interface DirectMessageFilter {
  $or: Array<{
    senderId: ObjectId;
    recipientId: ObjectId;
  }>;
  isDeleted: boolean;
  projectId: { $exists: false };
  recipientId?: ObjectId;
  isRead?: boolean;
}

interface FileQueryFilter {
  _id: { $in: ObjectId[] };
  projectId?: ObjectId;
}

// User and project document types for database operations
interface DatabaseUser {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface DatabaseProject {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
}

interface DatabaseFile {
  _id: ObjectId;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  projectId?: ObjectId;
}

// Type-safe database collection interface
interface DatabaseCollections {
  messages: MessageDocument;
  users: DatabaseUser;
  projects: DatabaseProject;
  files: DatabaseFile;
}

// Type-safe aggregation pipeline result
interface PopulatedMessage extends Omit<MessageDocument, 'senderId' | 'recipientId' | 'projectId'> {
  sender: DatabaseUser;
  recipient: DatabaseUser;
  project?: Pick<DatabaseProject, '_id' | 'title'>;
}

// GET /api/messages - Retrieve messages for a project or direct conversation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const participantId = searchParams.get('participantId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Validate input parameters
    if (!participantId) {
      return NextResponse.json({
        success: false,
        error: 'Participant ID is required'
      }, { status: 400 });
    }

    if (!ObjectId.isValid(participantId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid participant ID format'
      }, { status: 400 });
    }

    if (projectId && !ObjectId.isValid(projectId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID format'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);
    const participantObjectId = new ObjectId(participantId);

    // Handle project-based messaging
    if (projectId) {
      const projectObjectId = new ObjectId(projectId);

      // Verify user has access to project
      const project: WithId<Document> | null = await db.collection('projects').findOne({
        _id: projectObjectId,
        $or: [
          { client: currentUserId },
          { managers: currentUserId }
        ]
      });

      if (!project && session.user.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: 'Access denied to project messages'
        }, { status: 403 });
      }

      // Build type-safe query for project messages
      const projectQuery: ProjectMessageFilter = {
        projectId: projectObjectId,
        isDeleted: false,
        $or: [
          { senderId: currentUserId, recipientId: participantObjectId },
          { senderId: participantObjectId, recipientId: currentUserId }
        ]
      };

      if (unreadOnly) {
        projectQuery.recipientId = currentUserId;
        projectQuery.isRead = false;
      }

      const projectMessages = await db.collection('messages')
        .aggregate<PopulatedMessage>([
          { $match: projectQuery },
          { $sort: { createdAt: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
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
              from: 'projects',
              localField: 'projectId',
              foreignField: '_id',
              as: 'project',
              pipeline: [{ $project: { title: 1 } }]
            }
          },
          {
            $addFields: {
              sender: { $arrayElemAt: ['$sender', 0] },
              recipient: { $arrayElemAt: ['$recipient', 0] },
              project: { $arrayElemAt: ['$project', 0] }
            }
          }
        ])
        .toArray();

      return NextResponse.json({
        success: true,
        messages: projectMessages,
        pagination: {
          page,
          limit,
          total: await db.collection('messages').countDocuments(projectQuery)
        }
      });
    }

    // Handle direct conversation messaging (without project)
    else {
      // Verify participants can message each other
      const [currentUser, participant] = await Promise.all([
        db.collection('users').findOne(
          { _id: currentUserId, isActive: true },
          { projection: { password: 0 } }
        ) as Promise<DatabaseUser | null>,
        db.collection('users').findOne(
          { _id: participantObjectId, isActive: true },
          { projection: { password: 0 } }
        ) as Promise<DatabaseUser | null>
      ]);

      if (!currentUser || !participant) {
        return NextResponse.json({
          success: false,
          error: 'User not found or inactive'
        }, { status: 404 });
      }

      // Check messaging permissions
      const canMessage = await validateMessagingPermission(
        currentUserId.toString(),
        participantObjectId.toString(),
        currentUser.role,
        participant.role,
        db
      );

      if (!canMessage) {
        return NextResponse.json({
          success: false,
          error: 'Not authorized to message this user'
        }, { status: 403 });
      }

      // Build type-safe query for direct messages
      const directQuery: DirectMessageFilter = {
        $or: [
          { senderId: currentUserId, recipientId: participantObjectId },
          { senderId: participantObjectId, recipientId: currentUserId }
        ],
        isDeleted: false,
        projectId: { $exists: false } // Only direct messages without project context
      };

      if (unreadOnly) {
        directQuery.recipientId = currentUserId;
        directQuery.isRead = false;
      }

      const directMessages = await db.collection('messages')
        .aggregate<PopulatedMessage>([
          { $match: directQuery },
          { $sort: { createdAt: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
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
        messages: directMessages,
        pagination: {
          page,
          limit,
          total: await db.collection('messages').countDocuments(directQuery)
        }
      });
    }

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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json() as {
      projectId?: string;
      recipientId: string;
      content: string;
      messageType?: 'text' | 'image' | 'file' | 'audio' | 'video';
      attachments?: Array<{ fileId: string }>;
      replyTo?: string;
    };

    const { projectId, recipientId, content, messageType = 'text', attachments = [], replyTo } = body;

    // Validate required fields
    if (!recipientId || !content?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Recipient ID and content are required'
      }, { status: 400 });
    }

    // Validate ObjectIds
    if (!ObjectId.isValid(recipientId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid recipient ID format'
      }, { status: 400 });
    }

    if (projectId && !ObjectId.isValid(projectId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID format'
      }, { status: 400 });
    }

    if (replyTo && !ObjectId.isValid(replyTo)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid reply message ID format'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);
    const recipientObjectId = new ObjectId(recipientId);

    // Handle project-based messaging
    if (projectId) {
      const projectObjectId = new ObjectId(projectId);

      // Verify user has access to project
      const project: WithId<Document> | null = await db.collection('projects').findOne({
        _id: projectObjectId,
        $or: [
          { client: currentUserId },
          { managers: currentUserId }
        ]
      });

      if (!project && session.user.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: 'Access denied to project'
        }, { status: 403 });
      }

      // Verify recipient has access to project
      const recipientHasAccess = await db.collection('projects').findOne({
        _id: projectObjectId,
        $or: [
          { client: recipientObjectId },
          { manager: recipientObjectId }
        ]
      });

      if (!recipientHasAccess && session.user.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: 'Recipient does not have access to this project'
        }, { status: 403 });
      }
    }

    // Handle direct messaging (without project)
    else {
      // Verify participants can message each other
      const [currentUser, recipient] = await Promise.all([
        db.collection('users').findOne(
          { _id: currentUserId, isActive: true },
          { projection: { password: 0 } }
        ) as Promise<DatabaseUser | null>,
        db.collection('users').findOne(
          { _id: recipientObjectId, isActive: true },
          { projection: { password: 0 } }
        ) as Promise<DatabaseUser | null>
      ]);

      if (!currentUser || !recipient) {
        return NextResponse.json({
          success: false,
          error: 'User not found or inactive'
        }, { status: 404 });
      }

      // Check messaging permissions
      const canMessage = await validateMessagingPermission(
        currentUserId.toString(),
        recipientObjectId.toString(),
        currentUser.role,
        recipient.role,
        db
      );

      if (!canMessage) {
        return NextResponse.json({
          success: false,
          error: 'Not authorized to message this user'
        }, { status: 403 });
      }
    }

    // Validate attachments if provided
    let validatedAttachments: MessageAttachment[] = [];
    if (attachments.length > 0) {
      const fileIds = attachments.map((att) => new ObjectId(att.fileId));
      const fileQuery: FileQueryFilter = { _id: { $in: fileIds } };
      
      if (projectId) {
        fileQuery.projectId = new ObjectId(projectId);
      }

      const files = await db.collection('files').find(fileQuery).toArray() as DatabaseFile[];

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
      senderId: currentUserId,
      recipientId: recipientObjectId,
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

    // Add projectId only if provided
    if (projectId) {
      messageData.projectId = new ObjectId(projectId);
    }

    const result = await db.collection('messages').insertOne(messageData);

    // Get the created message with populated fields
    const createdMessage = await db.collection('messages')
      .aggregate<PopulatedMessage>([
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
        ...(projectId ? [{
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project',
            pipeline: [{ $project: { title: 1 } }]
          }
        }] : []),
        {
          $addFields: {
            sender: { $arrayElemAt: ['$sender', 0] },
            recipient: { $arrayElemAt: ['$recipient', 0] },
            ...(projectId && { project: { $arrayElemAt: ['$project', 0] } })
          }
        }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      message: createdMessage[0],
      data: createdMessage[0] // For backward compatibility
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

// Helper function to validate messaging permissions
async function validateMessagingPermission(
  senderId: string,
  recipientId: string,
  senderRole: string,
  recipientRole: string,
  db: Db
): Promise<boolean> {
  try {
    // Super admin can message anyone
    if (senderRole === 'super_admin' || recipientRole === 'super_admin') {
      return true;
    }

    // Project manager messaging rules
    if (senderRole === 'project_manager') {
      // Can message clients they manage
      if (recipientRole === 'client') {
        const hasSharedProject = await db.collection('projects').findOne({
          managers: new ObjectId(senderId),
          client: new ObjectId(recipientId)
        });
        return !!hasSharedProject;
      }
      return false;
    }

    // Client messaging rules
    if (senderRole === 'client') {
      // Can message their project manager
      if (recipientRole === 'project_manager') {
        const hasSharedProject = await db.collection('projects').findOne({
          client: new ObjectId(senderId),
          managers: new ObjectId(recipientId)
        });
        return !!hasSharedProject;
      }
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error validating message permission:', error);
    return false;
  }
}