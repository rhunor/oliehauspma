// src/app/api/messages/conversations/route.ts - ENHANCED WITH BETTER ERROR HANDLING
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { getAvailableContacts } from '@/lib/messaging-permissions';

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
  projectId?: ObjectId;
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
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const currentUserId = new ObjectId(session.user.id);

    // Get conversations using aggregation pipeline
    const conversations = await db.collection('messages')
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

    // Get available contacts for new conversations
    let availableContacts: Array<{
      _id: string;
      name: string;
      email: string;
      role: string;
    }> = [];

    try {
      availableContacts = await getAvailableContacts(session.user.id, session.user.role);
    } catch (contactError) {
      console.warn('Failed to get available contacts:', contactError);
      // Continue without available contacts - this is not critical
    }

    // Convert to client-compatible format
    const clientConversations: ClientConversation[] = conversations.map(conv => {
      const participant = conv.participantData[0];
      const project = conv.projectData[0];
      
      // Determine if user is online (last seen within 5 minutes)
      const isOnline = participant.lastSeen 
        ? (Date.now() - new Date(participant.lastSeen).getTime()) < 5 * 60 * 1000 
        : false;

      return {
        participantId: participant._id.toString(),
        participantName: participant.name,
        participantRole: participant.role,
        lastMessage: conv.lastMessage || '',
        lastMessageTime: conv.lastMessageTime.toISOString(),
        unreadCount: conv.unreadCount,
        projectTitle: project?.title,
        projectId: project?._id.toString(),
        isOnline
      };
    });

    // Add contacts that don't have conversations yet
    const existingParticipantIds = new Set(clientConversations.map(c => c.participantId));
    const newContactConversations: ClientConversation[] = availableContacts
      .filter(contact => !existingParticipantIds.has(contact._id))
      .map(contact => ({
        participantId: contact._id,
        participantName: contact.name,
        participantRole: contact.role,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        isOnline: false
      }));

    const allConversations = [...clientConversations, ...newContactConversations];

    return NextResponse.json({
      success: true,
      conversations: allConversations
    });

  } catch (error: unknown) {
    console.error('Error fetching conversations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    // Return empty conversations instead of error to prevent UI breaks
    return NextResponse.json({
      success: true,
      conversations: [],
      error: errorMessage
    }, { 
      status: 200,
      headers: {
        'X-Fallback': 'true'
      }
    });
  }
}

// POST /api/messages/conversations - Start new conversation (validate permission)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { participantId } = body;

    if (!participantId || !ObjectId.isValid(participantId)) {
      return NextResponse.json({ 
        success: false,
        error: 'Valid participant ID is required' 
      }, { status: 400 });
    }

    // Get available contacts to verify permission
    const availableContacts = await getAvailableContacts(session.user.id, session.user.role);
    const canStartConversation = availableContacts.some(contact => contact._id === participantId);

    if (!canStartConversation) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authorized to start conversation with this user' 
      }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    
    // Get participant details
    const participant = await db.collection('users').findOne(
      { _id: new ObjectId(participantId) },
      { projection: { password: 0 } }
    );

    if (!participant) {
      return NextResponse.json({ 
        success: false,
        error: 'Participant not found' 
      }, { status: 404 });
    }

    const conversation: ClientConversation = {
      participantId: participant._id.toString(),
      participantName: participant.name,
      participantRole: participant.role,
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      isOnline: false
    };

    return NextResponse.json({
      success: true,
      conversation
    });

  } catch (error: unknown) {
    console.error('Error starting conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 });
  }
}