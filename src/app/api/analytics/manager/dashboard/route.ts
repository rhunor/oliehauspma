// src/app/api/analytics/manager/dashboard/route.ts - MANAGER DASHBOARD ANALYTICS
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

    if (session.user.role !== 'project_manager') {
      return NextResponse.json(
        { error: 'Access denied - Project managers only' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const managerId = new ObjectId(session.user.id);

    // Get projects managed by this manager
    const managerProjects = await db.collection('projects')
      .find({ manager: managerId })
      .toArray();

    const projectIds = managerProjects.map(p => p._id);

    // Calculate project statistics
    const totalProjects = managerProjects.length;
    const activeProjects = managerProjects.filter(p => p.status === 'in_progress').length;
    const completedProjects = managerProjects.filter(p => p.status === 'completed').length;
    const overdueProjects = managerProjects.filter(p => 
      p.endDate && new Date(p.endDate) < new Date() && p.status !== 'completed'
    ).length;

    // Get task statistics
    const allTasks = await db.collection('tasks')
      .find({ projectId: { $in: projectIds } })
      .toArray();

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const overdueTasks = allTasks.filter(t => 
      t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed'
    ).length;

    const overdueItems = overdueProjects + overdueTasks;

    const stats = {
      totalProjects,
      activeProjects,
      completedProjects,
      overdueProjects,
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueItems
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error: unknown) {
    console.error('Error fetching manager dashboard analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}