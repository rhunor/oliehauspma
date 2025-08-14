// src/app/api/messages/conversations/route.ts - CONVERSATIONS API
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
  isRead: boolean;
  isDeleted: boolean;
  createdAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastSeen?: Date;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
}

interface ConversationResult {
  _id: {
    participantId: ObjectId;
  };
  participantData: UserDocument[];
  projectData: ProjectDocument[];
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

interface ClientConversation {
  participantId: string;
  participantName: string;
  participantRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  projectTitle?: string;
  projectId?: string;
  isOnline: boolean;
}

// GET /api/messages/conversations - Get all conversations for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);

    // Get conversations using aggregation pipeline
    const conversations = await db.collection<MessageDocument>('messages')
      .aggregate<ConversationResult>([
        {
          $match: {
            $or: [
              { senderId: currentUserId },
              { recipientId: currentUserId }
            ],
            isDeleted: false
          }
        },
        {
          $addFields: {
            participantId: {
              $cond: {
                if: { $eq: ['$senderId', currentUserId] },
                then: '$recipientId',
                else: '$senderId'
              }
            }
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: { participantId: '$participantId' },
            lastMessage: { $first: '$content' },
            lastMessageTime: { $first: '$createdAt' },
            projectId: { $first: '$projectId' },
            unreadCount: {
              $sum: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: ['$recipientId', currentUserId] },
                      { $eq: ['$isRead', false] }
                    ]
                  },
                  then: 1,
                  else: 0
                }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.participantId',
            foreignField: '_id',
            as: 'participantData',
            pipeline: [
              { $project: { password: 0 } },
              { $match: { isActive: true } }
            ]
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
          $match: {
            'participantData.0': { $exists: true }
          }
        },
        {
          $sort: { lastMessageTime: -1 }
        }
      ])
      .toArray();

    // Convert to client-compatible format
    const clientConversations: ClientConversation[] = conversations.map(conv => {
      const participant = conv.participantData[0];
      const project = conv.projectData[0];
      
      // Determine if user is online (last seen within 5 minutes)
      const isOnline = participant.lastSeen ? 
        (new Date().getTime() - new Date(participant.lastSeen).getTime()) < 5 * 60 * 1000 :
        false;

      return {
        participantId: participant._id.toString(),
        participantName: participant.name,
        participantRole: participant.role,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime.toISOString(),
        unreadCount: conv.unreadCount,
        projectTitle: project?.title,
        projectId: project?._id.toString(),
        isOnline
      };
    });

    return NextResponse.json({
      success: true,
      conversations: clientConversations
    });

  } catch (error: unknown) {
    console.error('Error fetching conversations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}