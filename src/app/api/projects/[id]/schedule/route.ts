// src/app/api/projects/[id]/schedule/route.ts - NEW SCHEDULE API
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define schedule activity structure
interface ScheduleActivity {
  _id: ObjectId;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
  resources?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define schedule phase structure
interface SchedulePhase {
  _id: ObjectId;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: ScheduleActivity[];
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Define project document with schedule
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client: ObjectId;
  manager: ObjectId;
  startDate?: Date;
  endDate?: Date;
  status: string;
  progress: number;
  siteSchedule?: {
    phases: SchedulePhase[];
    lastUpdated: Date;
    overallProgress: number;
    totalActivities: number;
    completedActivities: number;
    activeActivities: number;
    delayedActivities: number;
  };
}

// Response interfaces
interface ScheduleActivityResponse {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
  resources?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SchedulePhaseResponse {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: ScheduleActivityResponse[];
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SchedulePageProps {
  params: Promise<{ id: string }>;
}

async function validateProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<ProjectDocument | null> {
  const { db } = await connectToDatabase();

  if (!ObjectId.isValid(projectId)) {
    return null;
  }

  const projectFilter: Filter<ProjectDocument> = { _id: new ObjectId(projectId) };

  // Role-based access control
  if (userRole === 'client') {
    projectFilter.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectFilter.manager = new ObjectId(userId);
  }
  // super_admin can access all projects

  return await db.collection<ProjectDocument>('projects').findOne(projectFilter);
}

function calculatePhaseStatus(phase: SchedulePhase): 'upcoming' | 'active' | 'completed' | 'delayed' {
  const now = new Date();
  const startDate = new Date(phase.startDate);
  const endDate = new Date(phase.endDate);

  if (phase.progress === 100) {
    return 'completed';
  }

  if (now < startDate) {
    return 'upcoming';
  }

  if (now > endDate && phase.progress < 100) {
    return 'delayed';
  }

  return 'active';
}

function updateActivityStatus(activity: ScheduleActivity): ScheduleActivity['status'] {
  const now = new Date();
  const plannedEnd = new Date(activity.plannedEndDate);

  if (activity.progress === 100) {
    return 'completed';
  }

  if (now > plannedEnd && activity.progress < 100) {
    return 'delayed';
  }

  if (activity.progress > 0) {
    return 'in_progress';
  }

  return 'pending';
}

// GET /api/projects/[id]/schedule - Get project schedule
export async function GET(
  request: NextRequest,
  { params }: SchedulePageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await validateProjectAccess(projectId, session.user.id, session.user.role);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 });
    }

    // Initialize empty schedule if none exists
    if (!project.siteSchedule || !project.siteSchedule.phases) {
      // Create default phases for new projects
      const defaultPhases: SchedulePhase[] = [
        {
          _id: new ObjectId(),
          name: 'Planning & Design',
          description: 'Initial planning, design, and preparation phase',
          startDate: project.startDate || new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
          status: 'upcoming',
          progress: 0,
          activities: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const { db } = await connectToDatabase();
      await db.collection<ProjectDocument>('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $set: {
            'siteSchedule.phases': defaultPhases,
            'siteSchedule.lastUpdated': new Date(),
            'siteSchedule.overallProgress': 0,
            'siteSchedule.totalActivities': 0,
            'siteSchedule.completedActivities': 0,
            'siteSchedule.activeActivities': 0,
            'siteSchedule.delayedActivities': 0
          }
        }
      );

      project.siteSchedule = {
        phases: defaultPhases,
        lastUpdated: new Date(),
        overallProgress: 0,
        totalActivities: 0,
        completedActivities: 0,
        activeActivities: 0,
        delayedActivities: 0
      };
    }

    // Transform phases and update statuses
    const transformedPhases: SchedulePhaseResponse[] = project.siteSchedule.phases.map(phase => {
      // Update activity statuses
      const updatedActivities = phase.activities.map(activity => ({
        ...activity,
        status: updateActivityStatus(activity)
      }));

      // Calculate phase progress and status
      const totalActivities = updatedActivities.length;
      const completedActivities = updatedActivities.filter(a => a.status === 'completed').length;
      const phaseProgress = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

      const updatedPhase = {
        ...phase,
        activities: updatedActivities,
        progress: phaseProgress,
        status: calculatePhaseStatus({ ...phase, progress: phaseProgress })
      };

      return {
        _id: updatedPhase._id.toString(),
        name: updatedPhase.name,
        description: updatedPhase.description,
        startDate: updatedPhase.startDate.toISOString(),
        endDate: updatedPhase.endDate.toISOString(),
        status: updatedPhase.status,
        progress: updatedPhase.progress,
        dependencies: updatedPhase.dependencies,
        createdAt: updatedPhase.createdAt.toISOString(),
        updatedAt: updatedPhase.updatedAt.toISOString(),
        activities: updatedActivities.map(activity => ({
          _id: activity._id.toString(),
          title: activity.title,
          description: activity.description,
          contractor: activity.contractor,
          supervisor: activity.supervisor,
          plannedStartDate: activity.plannedStartDate.toISOString(),
          plannedEndDate: activity.plannedEndDate.toISOString(),
          actualStartDate: activity.actualStartDate?.toISOString(),
          actualEndDate: activity.actualEndDate?.toISOString(),
          status: activity.status,
          priority: activity.priority,
          category: activity.category,
          progress: activity.progress,
          estimatedDuration: activity.estimatedDuration,
          actualDuration: activity.actualDuration,
          dependencies: activity.dependencies,
          resources: activity.resources,
          notes: activity.notes,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString()
        }))
      };
    });

    // Calculate overall statistics
    const allActivities = transformedPhases.flatMap(phase => phase.activities);
    const completedActivities = allActivities.filter(a => a.status === 'completed');
    const activeActivities = allActivities.filter(a => a.status === 'in_progress');
    const delayedActivities = allActivities.filter(a => a.status === 'delayed');

    const overallProgress = allActivities.length > 0 
      ? Math.round((completedActivities.length / allActivities.length) * 100)
      : 0;

    const daysRemaining = project.endDate 
      ? Math.max(0, Math.ceil((project.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : undefined;

    const onSchedule = delayedActivities.length === 0 && 
      (project.endDate ? new Date() <= project.endDate : true);

    // Calculate upcoming activities (next 14 days)
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    const upcomingActivities = allActivities
      .filter(activity => {
        const startDate = new Date(activity.plannedStartDate);
        return startDate <= fourteenDaysFromNow && 
               ['pending', 'in_progress'].includes(activity.status);
      })
      .sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        project: {
          _id: project._id.toString(),
          title: project.title,
          startDate: project.startDate?.toISOString(),
          endDate: project.endDate?.toISOString(),
          status: project.status,
          progress: project.progress
        },
        phases: transformedPhases,
        overallStats: {
          totalActivities: allActivities.length,
          completedActivities: completedActivities.length,
          activeActivities: activeActivities.length,
          delayedActivities: delayedActivities.length,
          overallProgress,
          onSchedule,
          daysRemaining
        },
        upcomingActivities: upcomingActivities.slice(0, 10)
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching project schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/schedule - Create new phase
export async function POST(
  request: NextRequest,
  { params }: SchedulePageProps
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only project managers and super admins can create phases
    if (!['project_manager', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to create schedule phases'
      }, { status: 403 });
    }

    const { id: projectId } = await params;
    const project = await validateProjectAccess(projectId, session.user.id, session.user.role);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Phase name is required'
      }, { status: 400 });
    }

    if (!body.startDate || !body.endDate) {
      return NextResponse.json({
        success: false,
        error: 'Start date and end date are required'
      }, { status: 400 });
    }

    // Create new phase
    const newPhase: SchedulePhase = {
      _id: new ObjectId(),
      name: body.name.trim(),
      description: body.description?.trim() || '',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: 'upcoming',
      progress: 0,
      activities: [],
      dependencies: body.dependencies || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add phase to project
    const { db } = await connectToDatabase();
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $push: { 'siteSchedule.phases': newPhase },
        $set: { 
          'siteSchedule.lastUpdated': new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create phase'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: newPhase._id.toString(),
        name: newPhase.name,
        description: newPhase.description,
        startDate: newPhase.startDate.toISOString(),
        endDate: newPhase.endDate.toISOString(),
        status: newPhase.status,
        progress: newPhase.progress,
        activities: [],
        dependencies: newPhase.dependencies,
        createdAt: newPhase.createdAt.toISOString(),
        updatedAt: newPhase.updatedAt.toISOString()
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating schedule phase:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}