// src/app/api/calendar/[id]/route.ts - Individual Calendar Event Operations
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Db, Filter } from 'mongodb';
import { z } from 'zod';

const updateEventSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  allDay: z.boolean().optional(),
  type: z.enum(['meeting', 'deadline', 'milestone', 'reminder', 'event']).optional(),
  location: z.string().max(200).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  attendees: z.array(z.string()).optional(),
  reminders: z.array(z.object({
    type: z.enum(['email', 'notification']),
    minutesBefore: z.number().min(0)
  })).optional()
});

interface CalendarEventPageProps {
  params: Promise<{ id: string }>;
}

// Calendar event document interface
interface CalendarEventDocument {
  _id: ObjectId;
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

// User document interface
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

// Project document interface
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: string;
  client?: ObjectId;
  manager?: ObjectId;
}

// Aggregated event result interface
interface AggregatedEvent extends CalendarEventDocument {
  creator?: UserDocument;
  attendeeDetails?: UserDocument[];
  project?: Pick<ProjectDocument, '_id' | 'title' | 'status'>;
}

// Update document interface
interface UpdateDocument {
  updatedAt: Date;
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  allDay?: boolean;
  type?: CalendarEventDocument['type'];
  location?: string;
  priority?: CalendarEventDocument['priority'];
  status?: CalendarEventDocument['status'];
  attendees?: ObjectId[];
  reminders?: CalendarEventDocument['reminders'];
}

// GET /api/calendar/[id] - Get specific event
export async function GET(
  request: NextRequest,
  { params }: CalendarEventPageProps
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid event ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get event with related data
    const pipeline = [
      { $match: { _id: new ObjectId(id) } },
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
        $addFields: {
          creator: { $arrayElemAt: ['$creator', 0] },
          project: { $arrayElemAt: ['$project', 0] }
        }
      }
    ];

    const eventResult = await db.collection<CalendarEventDocument>('calendar_events').aggregate<AggregatedEvent>(pipeline).toArray();
    
    if (eventResult.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Event not found' 
      }, { status: 404 });
    }

    const event = eventResult[0];

    // Check access permissions
    const hasAccess = session.user.role === 'super_admin' ||
                     event.createdBy.equals(userId) ||
                     event.attendees.some((attendee: ObjectId) => attendee.equals(userId)) ||
                     (event.projectId && await checkProjectAccess(db, event.projectId.toString(), userId, session.user.role));

    if (!hasAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 });
    }

    // Transform for client
    const transformedEvent = {
      ...event,
      _id: event._id.toString(),
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
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: transformedEvent
    });

  } catch (error: unknown) {
    console.error('Error fetching calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// PUT /api/calendar/[id] - Update event
export async function PUT(
  request: NextRequest,
  { params }: CalendarEventPageProps
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid event ID' 
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate input
    const validation = updateEventSchema.safeParse(body);
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

    // Get current event
    const currentEvent = await db.collection<CalendarEventDocument>('calendar_events').findOne({ _id: new ObjectId(id) });
    
    if (!currentEvent) {
      return NextResponse.json({ 
        success: false, 
        error: 'Event not found' 
      }, { status: 404 });
    }

    // Check permissions
    const canUpdate = session.user.role === 'super_admin' ||
                     currentEvent.createdBy.equals(userId) ||
                     (currentEvent.projectId && await checkProjectAccess(db, currentEvent.projectId.toString(), userId, session.user.role));

    if (!canUpdate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Build update object
    const updateDoc: UpdateDocument = {
      updatedAt: new Date()
    };

    if (data.title) updateDoc.title = data.title;
    if (data.description !== undefined) updateDoc.description = data.description;
    if (data.startDate) updateDoc.startDate = new Date(data.startDate);
    if (data.endDate) updateDoc.endDate = new Date(data.endDate);
    if (data.allDay !== undefined) updateDoc.allDay = data.allDay;
    if (data.type) updateDoc.type = data.type;
    if (data.location !== undefined) updateDoc.location = data.location;
    if (data.priority) updateDoc.priority = data.priority;
    if (data.status) updateDoc.status = data.status;
    if (data.attendees) updateDoc.attendees = data.attendees.map(id => new ObjectId(id));
    if (data.reminders) updateDoc.reminders = data.reminders;

    // Update event
    const result = await db.collection<CalendarEventDocument>('calendar_events').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Event not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Event updated successfully' }
    });

  } catch (error: unknown) {
    console.error('Error updating calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// DELETE /api/calendar/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: CalendarEventPageProps
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid event ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get event to check permissions
    const event = await db.collection<CalendarEventDocument>('calendar_events').findOne({ _id: new ObjectId(id) });
    
    if (!event) {
      return NextResponse.json({ 
        success: false, 
        error: 'Event not found' 
      }, { status: 404 });
    }

    // Check permissions
    const canDelete = session.user.role === 'super_admin' ||
                     event.createdBy.equals(userId) ||
                     (event.projectId && await checkProjectAccess(db, event.projectId.toString(), userId, session.user.role));

    if (!canDelete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions' 
      }, { status: 403 });
    }

    // Delete event
    const result = await db.collection<CalendarEventDocument>('calendar_events').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Event not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Event deleted successfully' }
    });

  } catch (error: unknown) {
    console.error('Error deleting calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
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