// src/app/api/calendar/route.ts - Calendar Events API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Db, Collection, Filter } from 'mongodb';
import { z } from 'zod';

// Event validation schema
const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  allDay: z.boolean().optional(),
  type: z.enum(['meeting', 'deadline', 'milestone', 'reminder', 'event']),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  reminders: z.array(z.object({
    type: z.enum(['email', 'notification']),
    minutesBefore: z.number().min(0)
  })).optional()
});

// Event document interface
interface CalendarEventDocument {
  _id?: ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  type: 'meeting' | 'deadline' | 'milestone' | 'reminder' | 'event';
  projectId?: ObjectId;
  taskId?: ObjectId;
  createdBy: ObjectId;
  attendees: ObjectId[];
  location?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reminders: Array<{
    type: 'email' | 'notification';
    minutesBefore: number;
  }>;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Project document interface for type safety
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: string;
  client?: ObjectId;
  manager?: ObjectId;
  endDate?: Date;
  milestones?: Array<{
    name: string;
    description?: string;
    dueDate: Date;
    status: string;
  }>;
}

// Task document interface
interface TaskDocument {
  _id: ObjectId;
  title: string;
  status: string;
  priority?: string;
  deadline?: Date;
  projectId: ObjectId;
  assignedTo?: ObjectId;
}

// User document interface
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isActive: boolean;
}

// Aggregated event result interface
interface AggregatedEvent extends CalendarEventDocument {
  creator?: UserDocument;
  attendeeDetails?: UserDocument[];
  project?: Pick<ProjectDocument, '_id' | 'title' | 'status'>;
  task?: Pick<TaskDocument, '_id' | 'title' | 'status'>;
}

// GET /api/calendar - Get calendar events
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');
    const view = searchParams.get('view') || 'month'; // month, week, day
    
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Build date filter
    let dateFilter: Filter<CalendarEventDocument> = {};
    if (startDate && endDate) {
      dateFilter = {
        $or: [
          {
            startDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          },
          {
            endDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          },
          {
            $and: [
              { startDate: { $lte: new Date(startDate) } },
              { endDate: { $gte: new Date(endDate) } }
            ]
          }
        ]
      };
    }

    // Build access filter based on user role
    let accessFilter: Filter<CalendarEventDocument> = {};
    
    if (session.user.role === 'client') {
      // Clients see events for their projects or events they're attending
      const clientProjects = await db.collection<ProjectDocument>('projects')
        .find({ client: userId }, { projection: { _id: 1 } })
        .toArray();
      
      const projectIds = clientProjects.map(p => p._id);
      accessFilter = {
        $or: [
          { projectId: { $in: projectIds } },
          { attendees: userId },
          { createdBy: userId }
        ]
      };
    } else if (session.user.role === 'project_manager') {
      // Project managers see events for projects they manage
      const managerProjects = await db.collection<ProjectDocument>('projects')
        .find({ manager: userId }, { projection: { _id: 1 } })
        .toArray();
      
      const projectIds = managerProjects.map(p => p._id);
      accessFilter = {
        $or: [
          { projectId: { $in: projectIds } },
          { attendees: userId },
          { createdBy: userId }
        ]
      };
    } else {
      // Super admins see all events
      accessFilter = {};
    }

    // Build complete filter
    const filter: Filter<CalendarEventDocument> = { ...accessFilter };
    
    if (Object.keys(dateFilter).length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push(dateFilter);
    }
    
    if (projectId && ObjectId.isValid(projectId)) {
      filter.projectId = new ObjectId(projectId);
    }
    
    if (type) {
      filter.type = type as CalendarEventDocument['type'];
    }

    // Get events with related data
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
          pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'attendees',
          foreignField: '_id',
          as: 'attendeeDetails',
          pipeline: [{ $project: { name: 1, email: 1, avatar: 1, role: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
          pipeline: [{ $project: { title: 1, status: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'task',
          pipeline: [{ $project: { title: 1, status: 1 } }]
        }
      },
      {
        $addFields: {
          creator: { $arrayElemAt: ['$creator', 0] },
          project: { $arrayElemAt: ['$project', 0] },
          task: { $arrayElemAt: ['$task', 0] }
        }
      },
      { $sort: { startDate: 1 } }
    ];

    const events = await db.collection<CalendarEventDocument>('calendar_events').aggregate<AggregatedEvent>(pipeline).toArray();

    // Transform for client
    const transformedEvents = events.map(event => ({
      ...event,
      _id: event._id?.toString(),
      projectId: event.projectId?.toString(),
      taskId: event.taskId?.toString(),
      createdBy: event.createdBy.toString(),
      attendees: event.attendees.map((id: ObjectId) => id.toString()),
      attendeeDetails: event.attendeeDetails?.map((attendee: UserDocument) => ({
        ...attendee,
        _id: attendee._id.toString()
      })) || [],
      creator: event.creator ? {
        ...event.creator,
        _id: event.creator._id.toString()
      } : null,
      project: event.project ? {
        ...event.project,
        _id: event.project._id.toString()
      } : null,
      task: event.task ? {
        ...event.task,
        _id: event.task._id.toString()
      } : null,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    }));

    // Get automatic events from projects and tasks
    const automaticEvents = await generateAutomaticEvents(db, userId, session.user.role, dateFilter);

    // Combine manual and automatic events
    const allEvents = [...transformedEvents, ...automaticEvents];

    return NextResponse.json({
      success: true,
      data: {
        events: allEvents,
        view,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching calendar events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// POST /api/calendar - Create new event
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
    
    // Validate input
    const validation = createEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const data = validation.data;
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Validate project access if projectId provided
    if (data.projectId) {
      const hasAccess = await checkProjectAccess(db, data.projectId, userId, session.user.role);
      if (!hasAccess) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied to project' 
        }, { status: 403 });
      }
    }

    // Validate task access if taskId provided
    if (data.taskId) {
      const task = await db.collection<TaskDocument>('tasks').findOne({ _id: new ObjectId(data.taskId) });
      if (!task) {
        return NextResponse.json({ 
          success: false, 
          error: 'Task not found' 
        }, { status: 404 });
      }
    }

    // Validate attendees
    const attendeeIds = (data.attendees || []).map(id => new ObjectId(id));
    if (attendeeIds.length > 0) {
      const validAttendees = await db.collection<UserDocument>('users').find({
        _id: { $in: attendeeIds },
        isActive: true
      }).toArray();

      if (validAttendees.length !== attendeeIds.length) {
        return NextResponse.json({ 
          success: false, 
          error: 'One or more attendees not found' 
        }, { status: 400 });
      }
    }

    // Create event document
    const eventDoc: Omit<CalendarEventDocument, '_id'> = {
      title: data.title,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      allDay: data.allDay || false,
      type: data.type,
      projectId: data.projectId ? new ObjectId(data.projectId) : undefined,
      taskId: data.taskId ? new ObjectId(data.taskId) : undefined,
      createdBy: userId,
      attendees: attendeeIds,
      location: data.location,
      isRecurring: data.isRecurring || false,
      recurrenceRule: data.recurrenceRule,
      priority: data.priority || 'medium',
      reminders: data.reminders || [],
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<CalendarEventDocument>('calendar_events').insertOne(eventDoc);

    return NextResponse.json({
      success: true,
      data: {
        eventId: result.insertedId.toString(),
        message: 'Event created successfully'
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// Automatic event interface
interface AutomaticEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  type: string;
  projectId?: string;
  taskId?: string;
  createdBy: string;
  attendees: string[];
  priority: string;
  status: string;
  isAutomatic: boolean;
}

// Helper function to generate automatic events from projects and tasks
async function generateAutomaticEvents(
  db: Db, 
  userId: ObjectId, 
  userRole: string, 
  dateFilter: Filter<CalendarEventDocument>
): Promise<AutomaticEvent[]> {
  const automaticEvents: AutomaticEvent[] = [];

  try {
    // Get user's accessible projects
    // FIXED: Changed let to const since projectFilter is never reassigned
    const projectFilter: Filter<ProjectDocument> = {};
    
    if (userRole === 'client') {
      projectFilter.client = userId;
    } else if (userRole === 'project_manager') {
      projectFilter.manager = userId;
    }

    const projects = await db.collection<ProjectDocument>('projects').find(projectFilter).toArray();
    const projectIds = projects.map((p: ProjectDocument) => p._id);

    // Add project deadlines as events
    for (const project of projects) {
      if (project.endDate) {
        const event: AutomaticEvent = {
          _id: `project_deadline_${project._id}`,
          title: `Project Deadline: ${project.title}`,
          description: `Deadline for project: ${project.title}`,
          startDate: project.endDate.toISOString(),
          endDate: project.endDate.toISOString(),
          allDay: true,
          type: 'deadline',
          projectId: project._id.toString(),
          createdBy: 'system',
          attendees: [],
          priority: 'high',
          status: project.status === 'completed' ? 'completed' : 'scheduled',
          isAutomatic: true
        };

        // Check if event falls within date filter
        if (!dateFilter || isEventInDateRange(event, dateFilter)) {
          automaticEvents.push(event);
        }
      }

      // Add project milestones
      if (project.milestones) {
        for (const milestone of project.milestones) {
          if (milestone.dueDate) {
            const event: AutomaticEvent = {
              _id: `milestone_${project._id}_${milestone.name.replace(/\s+/g, '_')}`,
              title: `Milestone: ${milestone.name}`,
              description: milestone.description || `Milestone for ${project.title}`,
              startDate: new Date(milestone.dueDate).toISOString(),
              endDate: new Date(milestone.dueDate).toISOString(),
              allDay: true,
              type: 'milestone',
              projectId: project._id.toString(),
              createdBy: 'system',
              attendees: [],
              priority: 'medium',
              status: milestone.status === 'completed' ? 'completed' : 'scheduled',
              isAutomatic: true
            };

            if (!dateFilter || isEventInDateRange(event, dateFilter)) {
              automaticEvents.push(event);
            }
          }
        }
      }
    }

    // Add task deadlines
    const taskFilter: Filter<TaskDocument> = { projectId: { $in: projectIds } };
    if (dateFilter && '$or' in dateFilter && Array.isArray(dateFilter.$or) && dateFilter.$or.length > 0) {
      const firstOrCondition = dateFilter.$or[0];
      if (firstOrCondition && 'startDate' in firstOrCondition && firstOrCondition.startDate) {
        const startDateFilter = firstOrCondition.startDate;
        if (typeof startDateFilter === 'object' && startDateFilter !== null && '$gte' in startDateFilter && '$lte' in startDateFilter) {
          const gteValue = startDateFilter.$gte;
          const lteValue = startDateFilter.$lte;
          
          // Type guard to ensure we have valid date values
          if (gteValue instanceof Date && lteValue instanceof Date) {
            taskFilter.deadline = {
              $gte: gteValue,
              $lte: lteValue
            };
          } else if (typeof gteValue === 'string' && typeof lteValue === 'string') {
            taskFilter.deadline = {
              $gte: new Date(gteValue),
              $lte: new Date(lteValue)
            };
          }
        }
      }
    }

    const tasks = await db.collection<TaskDocument>('tasks').find(taskFilter).toArray();

    for (const task of tasks) {
      if (task.deadline) {
        const project = projects.find((p: ProjectDocument) => p._id.equals(task.projectId));
        const event: AutomaticEvent = {
          _id: `task_deadline_${task._id}`,
          title: `Task Due: ${task.title}`,
          description: `Task deadline in ${project?.title || 'Unknown Project'}`,
          startDate: task.deadline.toISOString(),
          endDate: task.deadline.toISOString(),
          allDay: true,
          type: 'deadline',
          projectId: task.projectId.toString(),
          taskId: task._id.toString(),
          createdBy: 'system',
          attendees: task.assignedTo ? [task.assignedTo.toString()] : [],
          priority: task.priority || 'medium',
          status: task.status === 'completed' ? 'completed' : 'scheduled',
          isAutomatic: true
        };

        automaticEvents.push(event);
      }
    }

    return automaticEvents;

  } catch (error) {
    console.error('Error generating automatic events:', error);
    return [];
  }
}

// Helper function to check if event falls within date range
function isEventInDateRange(event: AutomaticEvent, dateFilter: Filter<CalendarEventDocument>): boolean {
  if (!dateFilter || !('$or' in dateFilter) || !Array.isArray(dateFilter.$or)) return true;

  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);
  
  const firstOrCondition = dateFilter.$or[0];
  if (!firstOrCondition || !('startDate' in firstOrCondition) || !firstOrCondition.startDate) return true;
  
  const startDateCondition = firstOrCondition.startDate;
  if (typeof startDateCondition !== 'object' || startDateCondition === null) return true;
  if (!('$gte' in startDateCondition) || !('$lte' in startDateCondition)) return true;
  
  const gteValue = startDateCondition.$gte;
  const lteValue = startDateCondition.$lte;
  
  // Type guard for valid date values
  let filterStart: Date;
  let filterEnd: Date;
  
  if (gteValue instanceof Date && lteValue instanceof Date) {
    filterStart = gteValue;
    filterEnd = lteValue;
  } else if (typeof gteValue === 'string' && typeof lteValue === 'string') {
    filterStart = new Date(gteValue);
    filterEnd = new Date(lteValue);
  } else {
    return true; // If we can't determine the dates, include the event
  }

  return (eventStart >= filterStart && eventStart <= filterEnd) ||
         (eventEnd >= filterStart && eventEnd <= filterEnd) ||
         (eventStart <= filterStart && eventEnd >= filterEnd);
}

// Helper function to check project access
async function checkProjectAccess(
  db: Db, 
  projectId: string, 
  userId: ObjectId, 
  userRole: string
): Promise<boolean> {
  if (!ObjectId.isValid(projectId)) return false;

  const filter: Filter<ProjectDocument> = { _id: new ObjectId(projectId) };
  
  if (userRole === 'client') {
    filter.client = userId;
  } else if (userRole === 'project_manager') {
    filter.manager = userId;
  }
  // Super admins have access to all projects

  const project = await db.collection<ProjectDocument>('projects').findOne(filter);
  return !!project;
}