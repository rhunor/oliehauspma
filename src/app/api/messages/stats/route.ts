// src/app/api/messages/stats/route.ts - MESSAGE STATISTICS API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);
    const userRole = session.user.role;

    let unreadCount = 0;

    if (userRole === 'super_admin') {
      // Super admin sees all messages except private client-manager conversations
      unreadCount = await db.collection('chatmessages').countDocuments({
        $and: [
          { recipient: userId },
          { isRead: false },
          {
            $or: [
              { isSystemMessage: true },
              { sender: { $ne: userId } }
            ]
          }
        ]
      });
    } else if (userRole === 'project_manager') {
      // Project managers see messages from their clients and super admin
      const managerProjects = await db.collection('projects')
        .find({ manager: userId }, { projection: { _id: 1, client: 1 } })
        .toArray();
      
      const clientIds = managerProjects.map(p => p.client);
      
      unreadCount = await db.collection('chatmessages').countDocuments({
        $and: [
          { recipient: userId },
          { isRead: false },
          {
            $or: [
              { sender: { $in: clientIds } }, // Messages from their clients
              { 
                sender: { 
                  $in: await db.collection('users')
                    .find({ role: 'super_admin' }, { projection: { _id: 1 } })
                    .toArray()
                    .then(admins => admins.map(a => a._id))
                }
              } // Messages from super admins
            ]
          }
        ]
      });
    } else if (userRole === 'client') {
      // Clients see messages from their project manager and super admin
      const clientProjects = await db.collection('projects')
        .find({ client: userId }, { projection: { _id: 1, manager: 1 } })
        .toArray();
      
      const managerIds = clientProjects.map(p => p.manager);
      
      unreadCount = await db.collection('chatmessages').countDocuments({
        $and: [
          { recipient: userId },
          { isRead: false },
          {
            $or: [
              { sender: { $in: managerIds } }, // Messages from their managers
              { 
                sender: { 
                  $in: await db.collection('users')
                    .find({ role: 'super_admin' }, { projection: { _id: 1 } })
                    .toArray()
                    .then(admins => admins.map(a => a._id))
                }
              } // Messages from super admins
            ]
          }
        ]
      });
    }

    return NextResponse.json({
      success: true,
      unreadCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error fetching message stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}