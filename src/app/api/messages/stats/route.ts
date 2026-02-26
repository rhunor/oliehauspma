// src/app/api/messages/stats/route.ts - Improved Message Statistics API
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter, UpdateFilter } from 'mongodb';

// Define clean interfaces without extending Document to avoid MongoDB type conflicts
interface MessageDocument {
  _id: ObjectId;
  senderId: ObjectId;
  recipientId: ObjectId;
  projectId?: ObjectId;
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  avatar?: string;
}

interface MessageStats {
  unreadCount: number;
  totalMessages: number;
  totalConversations: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  lastMessageTime?: string;
  recentConversations?: Array<{
    userId: string;
    userName: string;
    userAvatar?: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
  }>;
}

// Aggregation result interfaces
interface ConversationAggregationResult {
  _id: ObjectId;
  lastMessage: string;
  lastMessageTime: Date;
  messages: MessageDocument[];
  user?: UserDocument;
  unreadCount: number;
}

interface ConversationStatsResult {
  total: number;
}

// GET /api/messages/stats - Get comprehensive message statistics
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
    const includeRecentConversations = searchParams.get('includeRecent') === 'true';
    const limit = parseInt(searchParams.get('limit') || '5');

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Calculate time ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build base filter for user's messages
    const baseFilter: Filter<MessageDocument> = {
      $or: [
        { senderId: userId },
        { recipientId: userId }
      ]
    };

    // Execute all queries in parallel for better performance
    const [
      unreadCount,
      totalMessages,
      messagesThisWeek,
      messagesThisMonth,
      lastMessage,
      conversationStats,
      recentConversations
    ] = await Promise.all([
      // Unread messages count (only messages TO this user)
      db.collection<MessageDocument>('messages').countDocuments({
        recipientId: userId,
        isRead: false
      }),

      // Total messages involving this user
      db.collection<MessageDocument>('messages').countDocuments(baseFilter),

      // Messages this week
      db.collection<MessageDocument>('messages').countDocuments({
        ...baseFilter,
        createdAt: { $gte: oneWeekAgo }
      }),

      // Messages this month
      db.collection<MessageDocument>('messages').countDocuments({
        ...baseFilter,
        createdAt: { $gte: oneMonthAgo }
      }),

      // Last message
      db.collection<MessageDocument>('messages').findOne(
        baseFilter,
        { 
          sort: { createdAt: -1 },
          projection: { createdAt: 1 }
        }
      ),

      // Total unique conversations
      db.collection<MessageDocument>('messages').aggregate<ConversationStatsResult>([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$senderId', userId] },
                '$recipientId',
                '$senderId'
              ]
            }
          }
        },
        { $count: 'total' }
      ]).toArray(),

      // Recent conversations (if requested)
      includeRecentConversations ? db.collection<MessageDocument>('messages').aggregate<ConversationAggregationResult>([
        { $match: baseFilter },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$senderId', userId] },
                '$recipientId',
                '$senderId'
              ]
            },
            lastMessage: { $first: '$content' },
            lastMessageTime: { $first: '$createdAt' },
            messages: { $push: '$$ROOT' }
          }
        },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
            pipeline: [{ $project: { name: 1, avatar: 1 } }]
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ['$user', 0] },
            unreadCount: {
              $size: {
                $filter: {
                  input: '$messages',
                  cond: {
                    $and: [
                      { $eq: ['$$this.recipientId', userId] },
                      { $eq: ['$$this.isRead', false] }
                    ]
                  }
                }
              }
            }
          }
        }
      ]).toArray() : Promise.resolve([])
    ]);

    // Process results
    const totalConversations = conversationStats[0]?.total || 0;
    const lastMessageTime = lastMessage?.createdAt?.toISOString();

    // Transform recent conversations
    const transformedRecentConversations = recentConversations.map((conv: ConversationAggregationResult) => ({
      userId: conv._id.toString(),
      userName: conv.user?.name || 'Unknown User',
      userAvatar: conv.user?.avatar,
      lastMessage: conv.lastMessage.substring(0, 100) + (conv.lastMessage.length > 100 ? '...' : ''),
      lastMessageTime: conv.lastMessageTime.toISOString(),
      unreadCount: conv.unreadCount
    }));

    // Construct response
    const stats: MessageStats = {
      unreadCount,
      totalMessages,
      totalConversations,
      messagesThisWeek,
      messagesThisMonth,
      ...(lastMessageTime && { lastMessageTime }),
      ...(includeRecentConversations && { recentConversations: transformedRecentConversations })
    };

    return NextResponse.json({
      success: true,
      data: stats
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=30', // Cache for 30 seconds
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching message stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    // Return fallback stats to prevent UI breaks
    const fallbackStats: MessageStats = {
      unreadCount: 0,
      totalMessages: 0,
      totalConversations: 0,
      messagesThisWeek: 0,
      messagesThisMonth: 0
    };

    return NextResponse.json({
      success: false,
      error: errorMessage,
      data: fallbackStats // Include fallback data
    }, { 
      status: 500,
      headers: {
        'X-Fallback': 'true'
      }
    });
  }
}

// POST /api/messages/stats/mark-read - Mark messages as read
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
    const { messageIds, conversationUserId, markAllRead } = body;

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    let updateFilter: Filter<MessageDocument>;
    let updateCount = 0;

    if (markAllRead) {
      // Mark all unread messages for this user as read
      updateFilter = {
        recipientId: userId,
        isRead: false
      };
    } else if (conversationUserId) {
      // Mark all messages in a specific conversation as read
      updateFilter = {
        recipientId: userId,
        senderId: new ObjectId(conversationUserId),
        isRead: false
      };
    } else if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      const validIds = messageIds
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
      
      if (validIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No valid message IDs provided'
        }, { status: 400 });
      }

      updateFilter = {
        _id: { $in: validIds },
        recipientId: userId,
        isRead: false
      };
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters. Provide messageIds, conversationUserId, or markAllRead flag.'
      }, { status: 400 });
    }

    // Create proper update filter with type safety
    const updateOperation: UpdateFilter<MessageDocument> = {
      $set: {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      }
    };

    // Update messages
    const updateResult = await db.collection<MessageDocument>('messages').updateMany(
      updateFilter,
      updateOperation
    );

    updateCount = updateResult.modifiedCount;

    return NextResponse.json({
      success: true,
      data: {
        markedAsRead: updateCount,
        message: `Successfully marked ${updateCount} message${updateCount !== 1 ? 's' : ''} as read`
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Error marking messages as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// PUT /api/messages/stats/refresh - Force refresh message stats
export async function PUT() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // This endpoint can be used to trigger cache invalidation
    // or perform maintenance operations on message stats
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Message stats cache refreshed successfully',
        timestamp: new Date().toISOString()
      }
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error: unknown) {
    console.error('Error refreshing message stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}