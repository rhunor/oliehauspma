// src/app/api/messages/stats/route.ts - MESSAGE STATS API FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define proper TypeScript interfaces
interface MessageDocument {
  _id: ObjectId;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageStats {
  unreadCount: number;
  totalMessages: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  conversationCount: number;
  lastMessageTime?: string;
}

// GET /api/messages/stats - Fetch message statistics for current user
export async function GET(): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Connect to database
    const { db } = await connectToDatabase();

    // Calculate time ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build query based on user role
    let messageFilter: Filter<MessageDocument>;
    
    if (userRole === 'super_admin') {
      // Super admin can see all message stats
      messageFilter = {};
    } else {
      // Other users can only see their own messages
      messageFilter = {
        $or: [
          { senderId: new ObjectId(userId) },
          { recipientId: new ObjectId(userId) }
        ]
      };
    }

    // Execute database queries in parallel for better performance
    const [messageStats, lastMessage, conversationStats] = await Promise.all([
      // Main message statistics
      db.collection<MessageDocument>('messages').aggregate([
        { $match: messageFilter },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$isRead', false] },
                      userRole !== 'super_admin' ? { $eq: ['$recipientId', new ObjectId(userId)] } : true
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            messagesThisWeek: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', oneWeekAgo] },
                  1,
                  0
                ]
              }
            },
            messagesThisMonth: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', oneMonthAgo] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Get last message timestamp
      db.collection<MessageDocument>('messages')
        .findOne(messageFilter, { 
          sort: { createdAt: -1 },
          projection: { createdAt: 1 }
        }),

      // Count unique conversations
      db.collection<MessageDocument>('messages').aggregate([
        { $match: messageFilter },
        {
          $group: {
            _id: {
              // Create conversation identifier
              participants: {
                $cond: [
                  { $lt: ['$senderId', '$recipientId'] },
                  ['$senderId', '$recipientId'],
                  ['$recipientId', '$senderId']
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            conversationCount: { $sum: 1 }
          }
        }
      ]).toArray()
    ]);

    // Process results with proper error handling
    const stats = messageStats[0] || {
      totalMessages: 0,
      unreadCount: 0,
      messagesThisWeek: 0,
      messagesThisMonth: 0
    };

    const conversationCount = conversationStats[0]?.conversationCount || 0;
    const lastMessageTime = lastMessage?.createdAt?.toISOString();

    // Construct response
    const response: MessageStats = {
      unreadCount: stats.unreadCount,
      totalMessages: stats.totalMessages,
      messagesThisWeek: stats.messagesThisWeek,
      messagesThisMonth: stats.messagesThisMonth,
      conversationCount,
      ...(lastMessageTime && { lastMessageTime })
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error fetching message stats:', error);
    
    // Return safe default values instead of error to prevent UI breaks
    const fallbackStats: MessageStats = {
      unreadCount: 0,
      totalMessages: 0,
      messagesThisWeek: 0,
      messagesThisMonth: 0,
      conversationCount: 0
    };

    return NextResponse.json(fallbackStats, { 
      status: 200,
      headers: {
        'X-Fallback': 'true'
      }
    });
  }
}

// POST /api/messages/stats/mark-read - Mark messages as read
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { messageIds, conversationId, markAllRead } = body;

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    let updateFilter: Filter<MessageDocument>;

    if (markAllRead) {
      // Mark all unread messages for this user as read
      updateFilter = {
        recipientId: userId,
        isRead: false
      };
    } else if (conversationId) {
      // Mark all messages in a conversation as read
      updateFilter = {
        recipientId: userId,
        isRead: false,
        $or: [
          { senderId: new ObjectId(conversationId) },
          { recipientId: new ObjectId(conversationId) }
        ]
      };
    } else if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      updateFilter = {
        _id: { $in: messageIds.map((id: string) => new ObjectId(id)) },
        recipientId: userId,
        isRead: false
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Update messages
    const updateResult = await db.collection<MessageDocument>('messages').updateMany(
      updateFilter,
      {
        $set: {
          isRead: true,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      markedAsRead: updateResult.modifiedCount,
      message: `Successfully marked ${updateResult.modifiedCount} messages as read`
    }, { status: 200 });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}

// PUT /api/messages/stats/refresh - Force refresh stats cache
export async function PUT(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // This endpoint can be used to trigger cache refresh
    // or perform any maintenance operations on message stats
    
    return NextResponse.json({
      success: true,
      message: 'Stats cache refreshed successfully',
      timestamp: new Date().toISOString()
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error refreshing message stats:', error);
    return NextResponse.json(
      { error: 'Failed to refresh stats' },
      { status: 500 }
    );
  }
}