// src/app/api/projects/[id]/incidents/route.ts - FIXED
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// FIXED: Proper interface definitions
interface InjuryDetails {
  injuryType: 'none' | 'minor' | 'major' | 'fatality';
  bodyPart?: string;
  treatmentRequired?: boolean;
  medicalAttention?: boolean;
}

interface CommentItem {
  _id: ObjectId;
  userId: ObjectId;
  userName: string;
  userRole: string;
  content: string;
  createdAt: Date;
}

interface IncidentDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  incidentCode: string;
  title: string;
  description: string;
  category: 'safety' | 'equipment' | 'environmental' | 'security' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  dateOccurred: Date;
  timeOccurred: string;
  reportedBy: ObjectId;
  witnessNames: string[];
  injuryDetails?: InjuryDetails;
  equipmentInvolved: string[];
  weatherConditions?: string;
  immediateActions: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: ObjectId;
  photos: string[];
  documents: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  comments: CommentItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Validate project access
async function validateProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  const { db } = await connectToDatabase();

  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });

  if (!project) return false;

  if (userRole === 'super_admin') return true;
  if (userRole === 'project_manager' && project.manager.equals(new ObjectId(userId))) return true;
  if (userRole === 'client' && project.client.equals(new ObjectId(userId))) return true;

  return false;
}

// GET /api/projects/[id]/incidents - Get all incidents for a project
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID'
      }, { status: 400 });
    }

    // Validate access
    const hasAccess = await validateProjectAccess(
      projectId,
      session.user.id,
      session.user.role
    );

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    const { db } = await connectToDatabase();

    // Get incidents with reporter and assignee details
    const incidents = await db.collection('incidents')
      .aggregate([
        { $match: { projectId: new ObjectId(projectId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'reportedBy',
            foreignField: '_id',
            as: 'reporterDetails',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assigneeDetails',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            reportedBy: { $arrayElemAt: ['$reporterDetails', 0] },
            assignedTo: { $arrayElemAt: ['$assigneeDetails', 0] }
          }
        },
        {
          $project: {
            reporterDetails: 0,
            assigneeDetails: 0
          }
        },
        { $sort: { dateOccurred: -1, createdAt: -1 } }
      ])
      .toArray();

    // Transform for client
    const clientIncidents = incidents.map(incident => ({
      _id: incident._id.toString(),
      projectId: incident.projectId.toString(),
      incidentCode: incident.incidentCode,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
      location: incident.location,
      dateOccurred: incident.dateOccurred.toISOString(),
      timeOccurred: incident.timeOccurred,
      reportedBy: {
        _id: incident.reportedBy?._id.toString() || '',
        name: incident.reportedBy?.name || 'Unknown',
        email: incident.reportedBy?.email || '',
        role: incident.reportedBy?.role || 'unknown'
      },
      witnessNames: incident.witnessNames,
      injuryDetails: incident.injuryDetails,
      equipmentInvolved: incident.equipmentInvolved,
      weatherConditions: incident.weatherConditions,
      immediateActions: incident.immediateActions,
      rootCause: incident.rootCause,
      correctiveActions: incident.correctiveActions,
      preventiveActions: incident.preventiveActions,
      status: incident.status,
      priority: incident.priority,
      assignedTo: incident.assignedTo ? {
        _id: incident.assignedTo._id.toString(),
        name: incident.assignedTo.name,
        email: incident.assignedTo.email
      } : undefined,
      photos: incident.photos,
      documents: incident.documents,
      followUpRequired: incident.followUpRequired,
      followUpDate: incident.followUpDate?.toISOString(),
      comments: incident.comments?.map((comment: CommentItem) => ({
        _id: comment._id.toString(),
        userId: comment.userId.toString(),
        userName: comment.userName,
        userRole: comment.userRole,
        content: comment.content,
        createdAt: comment.createdAt.toISOString()
      })) || [],
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: clientIncidents
    });

  } catch (error: unknown) {
    console.error('Error fetching incidents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/incidents - Create new incident
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID'
      }, { status: 400 });
    }

    // Only admins and managers can create incidents
    if (!['super_admin', 'project_manager'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Only administrators and project managers can create incident reports'
      }, { status: 403 });
    }

    // Validate access
    const hasAccess = await validateProjectAccess(
      projectId,
      session.user.id,
      session.user.role
    );

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      severity,
      location,
      dateOccurred,
      timeOccurred,
      witnessNames,
      injuryDetails,
      equipmentInvolved,
      weatherConditions,
      immediateActions,
      rootCause,
      correctiveActions,
      preventiveActions,
      assignedToId,
      photos,
      documents,
      followUpRequired,
      followUpDate
    } = body;

    // Validate required fields
    if (!title || !description || !category || !severity || !location || !dateOccurred || !immediateActions) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Generate incident code
    const incidentCount = await db.collection('incidents').countDocuments({
      projectId: new ObjectId(projectId)
    });
    const incidentCode = `INC-${String(incidentCount + 1).padStart(4, '0')}`;

    // Validate assignedTo if provided
    let assignedTo: ObjectId | undefined = undefined;
    if (assignedToId) {
      if (!ObjectId.isValid(assignedToId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid assignee ID'
        }, { status: 400 });
      }
      assignedTo = new ObjectId(assignedToId);
    }

    // Determine priority based on severity and injury type
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    if (severity === 'critical' || injuryDetails?.injuryType === 'fatality') {
      priority = 'urgent';
    } else if (severity === 'high' || injuryDetails?.injuryType === 'major') {
      priority = 'high';
    } else if (severity === 'low') {
      priority = 'low';
    }

    // FIXED: Properly construct incident data with all fields
    const incidentData: IncidentDocument = {
      projectId: new ObjectId(projectId),
      incidentCode,
      title,
      description,
      category,
      severity,
      location,
      dateOccurred: new Date(dateOccurred),
      timeOccurred: timeOccurred || '',
      reportedBy: new ObjectId(session.user.id),
      witnessNames: witnessNames || [],
      injuryDetails: injuryDetails || { injuryType: 'none' },
      equipmentInvolved: equipmentInvolved || [],
      weatherConditions: weatherConditions || '',
      immediateActions,
      rootCause: rootCause || '',
      correctiveActions: correctiveActions || '',
      preventiveActions: preventiveActions || '',
      status: 'open',
      priority,
      assignedTo,
      photos: photos || [],
      documents: documents || [],
      followUpRequired: followUpRequired || false,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('incidents').insertOne(incidentData);

    // Get created incident with reporter details
    const createdIncident = await db.collection('incidents')
      .aggregate([
        { $match: { _id: result.insertedId } },
        {
          $lookup: {
            from: 'users',
            localField: 'reportedBy',
            foreignField: '_id',
            as: 'reporterDetails',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            reportedBy: { $arrayElemAt: ['$reporterDetails', 0] }
          }
        },
        {
          $project: { reporterDetails: 0 }
        }
      ])
      .toArray();

    const incident = createdIncident[0];

    return NextResponse.json({
      success: true,
      data: {
        _id: incident._id.toString(),
        projectId: incident.projectId.toString(),
        incidentCode: incident.incidentCode,
        title: incident.title,
        description: incident.description,
        category: incident.category,
        severity: incident.severity,
        location: incident.location,
        dateOccurred: incident.dateOccurred.toISOString(),
        timeOccurred: incident.timeOccurred,
        reportedBy: {
          _id: incident.reportedBy._id.toString(),
          name: incident.reportedBy.name,
          email: incident.reportedBy.email
        },
        witnessNames: incident.witnessNames,
        injuryDetails: incident.injuryDetails,
        equipmentInvolved: incident.equipmentInvolved,
        weatherConditions: incident.weatherConditions,
        immediateActions: incident.immediateActions,
        rootCause: incident.rootCause,
        correctiveActions: incident.correctiveActions,
        preventiveActions: incident.preventiveActions,
        status: incident.status,
        priority: incident.priority,
        assignedTo: incident.assignedTo,
        photos: incident.photos,
        documents: incident.documents,
        followUpRequired: incident.followUpRequired,
        followUpDate: incident.followUpDate?.toISOString(),
        comments: [],
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString()
      },
      message: 'Incident report created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating incident:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}