// src/app/api/analytics/client/dashboard/route.ts - CLIENT DASHBOARD ANALYTICS
// Create this as a separate file: src/app/api/analytics/client/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'client') {
      return NextResponse.json(
        { error: 'Access denied - Clients only' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const clientId = new ObjectId(session.user.id);

    // Get projects for this client
    const clientProjects = await db.collection('projects')
      .find({ client: clientId })
      .toArray();

    const projectIds = clientProjects.map(p => p._id);

    // Calculate project statistics
    const totalProjects = clientProjects.length;
    const activeProjects = clientProjects.filter(p => p.status === 'in_progress').length;
    const completedProjects = clientProjects.filter(p => p.status === 'completed').length;
    
    // Calculate average progress
    const averageProgress = totalProjects > 0 
      ? clientProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / totalProjects 
      : 0;

    // Get unread messages count
    const unreadMessages = await db.collection('chatmessages').countDocuments({
      recipient: clientId,
      isRead: false
    });

    // Get recent files count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentFiles = await db.collection('files').countDocuments({
      projectId: { $in: projectIds },
      createdAt: { $gte: thirtyDaysAgo }
    });

    const stats = {
      totalProjects,
      activeProjects,
      completedProjects,
      averageProgress,
      unreadMessages,
      recentFiles
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error: unknown) {
    console.error('Error fetching client dashboard analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
