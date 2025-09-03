// src/app/api/projects/[id]/incidents/route.ts - INCIDENT REPORTING API (FIXED)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Import our types
import type { IncidentReportDocument } from '@/lib/types/incident';

// Interface for route params
interface IncidentRouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Interface for create incident request
interface CreateIncidentRequest {
  title: string;
  description: string;
  category: 'safety' | 'equipment' | 'environmental' | 'security' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  dateOccurred: string;
  timeOccurred?: string;
  witnessNames?: string[];
  injuryDetails?: {
    injuryType: 'none' | 'minor' | 'major' | 'fatality';
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved?: string[];
  weatherConditions?: string;
  immediateActions?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  photos?: string[];
  followUpRequired?: boolean;
  followUpDate?: string;
}

// GET /api/projects/[id]/incidents - Get project incidents
export async function GET(
  request: NextRequest,
  { params }: IncidentRouteParams
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
        error: 'Invalid project ID' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this project
    const projectFilter: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      projectFilter.client = userId;
    } else if (session.user.role === 'project_manager') {
      projectFilter.manager = userId;
    }
    // Super admin has access to all projects

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const category = url.searchParams.get('category');

    // Build incident filter using proper typing
    const incidentFilter: Record<string, unknown> = { 
      projectId: new ObjectId(id) 
    };

    if (status) incidentFilter.status = status;
    if (severity) incidentFilter.severity = severity;
    if (category) incidentFilter.category = category;

    // Get incidents with pagination
    const incidents = await db.collection<IncidentReportDocument>('incidentReports')
      .find(incidentFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const totalCount = await db.collection('incidentReports').countDocuments(incidentFilter);

    // Get reporter names
    const reporterIds = incidents.map(i => i.reportedBy).filter(Boolean);
    const reporters = await db.collection('users')
      .find({ _id: { $in: reporterIds } })
      .project({ name: 1 })
      .toArray();

    // Transform for response
    const transformedIncidents = incidents.map(incident => {
      const reporter = reporters.find(r => r._id.equals(incident.reportedBy));
      return {
        _id: incident._id?.toString(),
        projectId: incident.projectId.toString(),
        title: incident.title,
        description: incident.description,
        category: incident.category,
        severity: incident.severity,
        location: incident.location,
        dateOccurred: incident.dateOccurred.toISOString(),
        timeOccurred: incident.timeOccurred,
        reportedBy: incident.reportedBy.toString(),
        reportedByName: reporter?.name || 'Unknown',
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
        assignedTo: incident.assignedTo?.toString(),
        photos: incident.photos,
        documents: incident.documents,
        followUpRequired: incident.followUpRequired,
        followUpDate: incident.followUpDate?.toISOString(),
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString()
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        incidents: transformedIncidents,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
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

// POST /api/projects/[id]/incidents - Create incident report
export async function POST(
  request: NextRequest,
  { params }: IncidentRouteParams
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
        error: 'Invalid project ID' 
      }, { status: 400 });
    }

    const body: CreateIncidentRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.description || !body.category || !body.severity || !body.dateOccurred) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: title, description, category, severity, dateOccurred' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this project
    const projectFilter: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'client') {
      projectFilter.client = userId;
    } else if (session.user.role === 'project_manager') {
      projectFilter.manager = userId;
    }

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Get reporter name
    const reporter = await db.collection('users').findOne(
      { _id: userId },
      { projection: { name: 1 } }
    );

    // Create incident report
    const incidentDoc: IncidentReportDocument = {
      projectId: new ObjectId(id),
      title: body.title,
      description: body.description,
      category: body.category,
      severity: body.severity,
      location: body.location,
      dateOccurred: new Date(body.dateOccurred),
      timeOccurred: body.timeOccurred,
      reportedBy: userId,
      witnessNames: body.witnessNames,
      injuryDetails: body.injuryDetails,
      equipmentInvolved: body.equipmentInvolved,
      weatherConditions: body.weatherConditions,
      immediateActions: body.immediateActions,
      rootCause: body.rootCause,
      correctiveActions: body.correctiveActions,
      preventiveActions: body.preventiveActions,
      status: 'open',
      priority: body.priority || 'medium',
      photos: body.photos,
      documents: [],
      followUpRequired: body.followUpRequired || false,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<IncidentReportDocument>('incidentReports').insertOne(incidentDoc);

    const createdIncident = {
      _id: result.insertedId.toString(),
      projectId: incidentDoc.projectId.toString(),
      title: incidentDoc.title,
      description: incidentDoc.description,
      category: incidentDoc.category,
      severity: incidentDoc.severity,
      location: incidentDoc.location,
      dateOccurred: incidentDoc.dateOccurred.toISOString(),
      timeOccurred: incidentDoc.timeOccurred,
      reportedBy: incidentDoc.reportedBy.toString(),
      reportedByName: reporter?.name || 'Unknown',
      witnessNames: incidentDoc.witnessNames,
      injuryDetails: incidentDoc.injuryDetails,
      equipmentInvolved: incidentDoc.equipmentInvolved,
      weatherConditions: incidentDoc.weatherConditions,
      immediateActions: incidentDoc.immediateActions,
      rootCause: incidentDoc.rootCause,
      correctiveActions: incidentDoc.correctiveActions,
      preventiveActions: incidentDoc.preventiveActions,
      status: incidentDoc.status,
      priority: incidentDoc.priority,
      assignedTo: incidentDoc.assignedTo?.toString(),
      photos: incidentDoc.photos,
      documents: incidentDoc.documents,
      followUpRequired: incidentDoc.followUpRequired,
      followUpDate: incidentDoc.followUpDate?.toISOString(),
      createdAt: incidentDoc.createdAt.toISOString(),
      updatedAt: incidentDoc.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: {
        incident: createdIncident,
        message: 'Incident report created successfully'
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating incident report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}