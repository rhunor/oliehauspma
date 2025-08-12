// src/app/(dashboard)/admin/messages/page.tsx - FIXED SERVER COMPONENT
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import MessagesClient from '@/components/messaging/MessagesClient';

// Define types for the data structures
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: string;
  client?: ObjectId;
  manager?: ObjectId;
  updatedAt: Date;
}

interface MessageDocument {
  _id: ObjectId;
  content: string;
  createdAt: Date;
  sender: ObjectId;
  projectId: ObjectId;
  isDeleted?: boolean;
  isRead?: boolean;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  password?: string; // Excluded in projection
}

interface Project {
  _id: string;
  title: string;
  status: string;
}

interface Message {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    name: string;
  };
  project: {
    _id: string;
    title: string;
  };
}

interface MessageStats {
  totalMessages: number;
  unreadMessages: number;
  activeConversations: number;
}

interface MessageStatsResult {
  _id: null;
  totalMessages: number;
  unreadMessages: number;
  activeConversations: ObjectId[];
}

interface MessageWithJoins extends Omit<MessageDocument, 'sender' | 'projectId'> {
  sender: UserDocument;
  project: Pick<ProjectDocument, '_id' | 'title'>;
}

interface MessagingData {
  projects: Project[];
  recentMessages: Message[];
  stats: MessageStats;
}

async function getMessagingData(userId: string, userRole: string): Promise<MessagingData> {
  const { db } = await connectToDatabase();

  // Get user's projects for messaging with proper typing
  const projectsQuery: Filter<ProjectDocument> = {};
  
  if (userRole === 'client') {
    projectsQuery.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectsQuery.manager = new ObjectId(userId);
  }
  // super_admin can access all projects

  const userProjects = await db.collection<ProjectDocument>('projects')
    .find(projectsQuery)
    .project({ _id: 1, title: 1, status: 1 })
    .sort({ updatedAt: -1 })
    .toArray();

  // Get recent messages for these projects
  const projectIds = userProjects.map(p => p._id);
  const recentMessages = await db.collection<MessageDocument>('messages')
    .aggregate<MessageWithJoins>([
      { 
        $match: { 
          projectId: { $in: projectIds },
          isDeleted: { $ne: true }
        }
      },
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
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectData',
          pipeline: [{ $project: { title: 1 } }]
        }
      },
      {
        $addFields: {
          sender: { $arrayElemAt: ['$senderData', 0] },
          project: { $arrayElemAt: ['$projectData', 0] }
        }
      },
      { $unset: ['senderData', 'projectData'] },
      { $sort: { createdAt: -1 } },
      { $limit: 10 }
    ])
    .toArray();

  // Get message statistics with proper typing
  const messageStatsResult = await db.collection<MessageDocument>('messages').aggregate<MessageStatsResult>([
    { 
      $match: { 
        projectId: { $in: projectIds },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        unreadMessages: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$isRead', false] },
                  { $ne: ['$sender', new ObjectId(userId)] }
                ]
              },
              1, 
              0
            ]
          }
        },
        activeConversations: { $addToSet: '$projectId' }
      }
    }
  ]).toArray();

  // Transform the result to match MessageStats interface
  const rawStats = messageStatsResult[0];
  const stats: MessageStats = rawStats ? {
    totalMessages: rawStats.totalMessages,
    unreadMessages: rawStats.unreadMessages,
    activeConversations: rawStats.activeConversations.length
  } : { 
    totalMessages: 0, 
    unreadMessages: 0, 
    activeConversations: 0 
  };

  return {
    projects: JSON.parse(JSON.stringify(userProjects)) as Project[],
    recentMessages: JSON.parse(JSON.stringify(recentMessages)) as Message[],
    stats
  };
}

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const { projects, recentMessages, stats } = await getMessagingData(
    session.user.id, 
    session.user.role
  );

  // Pass all data to Client Component
  return (
    <MessagesClient 
      projects={projects}
      recentMessages={recentMessages}
      stats={stats}
    />
  );
}