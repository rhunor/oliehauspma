// src/app/api/analytics/manager/detailed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface AnalyticsData {
  projectMetrics: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    averageProgress: number;
    projectsThisMonth: number;
    projectCompletionRate: number;
  };
  taskMetrics: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    averageCompletionTime: number;
    taskCompletionRate: number;
  };
  clientMetrics: {
    totalClients: number;
    activeClients: number;
    clientSatisfactionScore: number;
    averageResponseTime: number;
  };
  timelineMetrics: {
    onTimeProjects: number;
    delayedProjects: number;
    averageProjectDuration: number;
    upcomingDeadlines: number;
  };
  monthlyData: Array<{
    month: string;
    projectsCompleted: number;
    tasksCompleted: number;
    clientMessages: number;
  }>;
  projectBreakdown: Array<{
    projectName: string;
    progress: number;
    status: string;
    daysRemaining: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'project_manager') {
      return NextResponse.json(
        { error: 'Access denied. Only project managers can view analytics.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range for filtering
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const { db } = await connectToDatabase();
    const managerId = new ObjectId(session.user.id);

    // ✅ Fix: Use startDate to filter projects within the time range
    const projects = await db.collection('projects')
      .find({ 
        manager: managerId,
        createdAt: { $gte: startDate } // Filter projects created within time range
      })
      .toArray();

    // Also get all projects for baseline metrics (not time-filtered)
    const allProjects = await db.collection('projects')
      .find({ manager: managerId })
      .toArray();

    if (allProjects.length === 0) {
      // Return empty analytics if no projects found
      const emptyAnalytics: AnalyticsData = {
        projectMetrics: {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          averageProgress: 0,
          projectsThisMonth: 0,
          projectCompletionRate: 0,
        },
        taskMetrics: {
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          averageCompletionTime: 0,
          taskCompletionRate: 0,
        },
        clientMetrics: {
          totalClients: 0,
          activeClients: 0,
          clientSatisfactionScore: 0,
          averageResponseTime: 0,
        },
        timelineMetrics: {
          onTimeProjects: 0,
          delayedProjects: 0,
          averageProjectDuration: 0,
          upcomingDeadlines: 0,
        },
        monthlyData: [],
        projectBreakdown: [],
      };

      return NextResponse.json({
        success: true,
        data: emptyAnalytics,
      });
    }

    // ✅ Use time-filtered projects for recent metrics, all projects for baseline
    const totalProjects = projects.length; // Time-filtered count
    const activeProjects = allProjects.filter(p => p.status === 'in_progress').length;
    const completedProjects = allProjects.filter(p => p.status === 'completed').length;
    const averageProgress = allProjects.length > 0 
      ? Math.round(allProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / allProjects.length)
      : 0;

    const currentMonth = new Date();
    currentMonth.setDate(1);
    const projectsThisMonth = allProjects.filter(p => 
      new Date(p.createdAt) >= currentMonth
    ).length;

    const projectCompletionRate = allProjects.length > 0 
      ? Math.round((completedProjects / allProjects.length) * 100)
      : 0;

    // Calculate timeline metrics using all projects
    const nowTime = new Date().getTime();
    const onTimeProjects = allProjects.filter(p => {
      if (p.status === 'completed') return true;
      if (!p.endDate) return true;
      return new Date(p.endDate).getTime() > nowTime;
    }).length;

    const delayedProjects = allProjects.filter(p => {
      if (p.status === 'completed') return false;
      if (!p.endDate) return false;
      return new Date(p.endDate).getTime() <= nowTime;
    }).length;

    const upcomingDeadlines = allProjects.filter(p => {
      if (p.status === 'completed') return false;
      if (!p.endDate) return false;
      const deadline = new Date(p.endDate).getTime();
      const weekFromNow = nowTime + (7 * 24 * 60 * 60 * 1000);
      return deadline > nowTime && deadline <= weekFromNow;
    }).length;

    // Get unique clients from all projects
    const uniqueClients = new Set(allProjects.map(p => p.client.toString()));
    const totalClients = uniqueClients.size;

    // Generate monthly data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const projectsCompletedThisMonth = allProjects.filter(p => 
        p.status === 'completed' &&
        p.updatedAt &&
        new Date(p.updatedAt) >= monthStart &&
        new Date(p.updatedAt) <= monthEnd
      ).length;

      monthlyData.push({
        month: monthName,
        projectsCompleted: projectsCompletedThisMonth,
        tasksCompleted: Math.floor(Math.random() * 50) + 10, // Placeholder
        clientMessages: Math.floor(Math.random() * 20) + 5, // Placeholder
      });
    }

    // Generate project breakdown from all projects
    const projectBreakdown = allProjects.slice(0, 10).map(project => {
      const daysRemaining = project.endDate 
        ? Math.max(0, Math.ceil((new Date(project.endDate).getTime() - nowTime) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        projectName: project.title,
        progress: project.progress || 0,
        status: project.status,
        daysRemaining,
      };
    });

    const analyticsData: AnalyticsData = {
      projectMetrics: {
        totalProjects,
        activeProjects,
        completedProjects,
        averageProgress,
        projectsThisMonth,
        projectCompletionRate,
      },
      taskMetrics: {
        totalTasks: allProjects.length * 5, // Estimated tasks per project
        completedTasks: Math.round(allProjects.length * 5 * (averageProgress / 100)),
        overdueTasks: delayedProjects * 2, // Estimated overdue tasks
        averageCompletionTime: 3.5, // Placeholder: 3.5 days average
        taskCompletionRate: averageProgress,
      },
      clientMetrics: {
        totalClients,
        activeClients: totalClients,
        clientSatisfactionScore: Math.round((8.5 + Math.random()) * 10) / 10, // Placeholder: 8.5-9.5
        averageResponseTime: Math.round((2 + Math.random() * 2) * 10) / 10, // Placeholder: 2-4 hours
      },
      timelineMetrics: {
        onTimeProjects,
        delayedProjects,
        averageProjectDuration: 45, // Placeholder: 45 days average
        upcomingDeadlines,
      },
      monthlyData,
      projectBreakdown,
    };

    return NextResponse.json({
      success: true,
      data: analyticsData,
    });

  } catch (error: unknown) {
    console.error('Error fetching analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}