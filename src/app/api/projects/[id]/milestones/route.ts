// src/app/api/projects/[id]/milestones/route.ts - MILESTONE API ENDPOINT (FIXED)
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Import our types and utilities
import type { MilestoneDocument } from '@/lib/types/milestone';
import { 
  calculateMilestoneProgress, 
  isValidMilestonePhase, 
  transformMilestoneForResponse 
} from '@/lib/utils/milestones';

// Interface for route params
interface MilestoneRouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Interface for create milestone request
interface CreateMilestoneRequest {
  phase: 'construction' | 'installation' | 'styling';
  title: string;
  description: string;
  notes?: string;
}

// GET /api/projects/[id]/milestones - Get project milestones
export async function GET(
  request: NextRequest,
  { params }: MilestoneRouteParams
) {
  try {
    const session = await auth();
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
      projectFilter.managers = userId;
    }
    // Super admin has access to all projects

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Get milestones for this project
    const milestones = await db.collection<MilestoneDocument>('milestones')
      .find({ projectId: new ObjectId(id) })
      .sort({ createdAt: 1 })
      .toArray();

    // Transform for response using utility function
    const transformedMilestones = milestones.map(transformMilestoneForResponse);

    // Calculate progress using utility function
    const progressData = calculateMilestoneProgress(milestones);

    return NextResponse.json({
      success: true,
      data: {
        milestones: transformedMilestones,
        progress: progressData
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching project milestones:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/milestones - Create project milestone (Admin/Manager only)
export async function POST(
  request: NextRequest,
  { params }: MilestoneRouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== 'super_admin' && session.user.role !== 'project_manager')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Admin or Manager access required' 
      }, { status: 401 });
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid project ID' 
      }, { status: 400 });
    }

    const body: CreateMilestoneRequest = await request.json();
    
    // Validate required fields
    if (!body.phase || !body.title || !body.description) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: phase, title, description' 
      }, { status: 400 });
    }

    // Validate phase using utility function
    if (!isValidMilestonePhase(body.phase)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid phase. Must be: construction, installation, or styling' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Check if user has access to this project
    const projectFilter: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (session.user.role === 'project_manager') {
      projectFilter.manager = userId;
    }

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }

    // Check if milestone for this phase already exists
    const existingMilestone = await db.collection('milestones').findOne({
      projectId: new ObjectId(id),
      phase: body.phase
    });

    if (existingMilestone) {
      return NextResponse.json({ 
        success: false, 
        error: `Milestone for ${body.phase} phase already exists` 
      }, { status: 409 });
    }

    // Create milestone
    const milestoneDoc: MilestoneDocument = {
      projectId: new ObjectId(id),
      phase: body.phase,
      title: body.title,
      description: body.description,
      status: 'pending',
      notes: body.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<MilestoneDocument>('milestones').insertOne(milestoneDoc);

    // Create response object with inserted ID
    const createdMilestone = {
      _id: result.insertedId.toString(),
      projectId: milestoneDoc.projectId.toString(),
      phase: milestoneDoc.phase,
      title: milestoneDoc.title,
      description: milestoneDoc.description,
      status: milestoneDoc.status,
      completedDate: milestoneDoc.completedDate?.toISOString(),
      completedBy: milestoneDoc.completedBy?.toString(),
      notes: milestoneDoc.notes,
      createdAt: milestoneDoc.createdAt.toISOString(),
      updatedAt: milestoneDoc.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: {
        milestone: createdMilestone,
        message: 'Milestone created successfully'
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating milestone:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}