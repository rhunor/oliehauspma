// src/app/api/milestones/[milestoneId]/route.ts - UPDATE MILESTONE ENDPOINT
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, UpdateFilter } from 'mongodb';

// Import our types and utilities
import type { MilestoneDocument } from '@/lib/types/milestone';
import { transformMilestoneForResponse } from '@/lib/utils/milestones';

// Interface for route params
interface MilestoneUpdateParams {
  params: Promise<{
    milestoneId: string;
  }>;
}

// Interface for update milestone request
interface UpdateMilestoneRequest {
  status?: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

// PUT /api/milestones/[milestoneId] - Update milestone
export async function PUT(
  request: NextRequest,
  { params }: MilestoneUpdateParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== 'super_admin' && session.user.role !== 'project_manager')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Admin or Manager access required' 
      }, { status: 401 });
    }

    const { milestoneId } = await params;
    
    if (!ObjectId.isValid(milestoneId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid milestone ID' 
      }, { status: 400 });
    }

    const body: UpdateMilestoneRequest = await request.json();
    
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get milestone and check access
    const milestone = await db.collection<MilestoneDocument>('milestones').findOne({
      _id: new ObjectId(milestoneId)
    });

    if (!milestone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Milestone not found' 
      }, { status: 404 });
    }

    // Check project access
    const projectFilter: Record<string, unknown> = { _id: milestone.projectId };
    
    if (session.user.role === 'project_manager') {
      projectFilter.managers = userId;
    }

    const project = await db.collection('projects').findOne(projectFilter);
    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied to this project' 
      }, { status: 403 });
    }

    // Prepare update fields - Build object first, then assign to $set
    const setFields: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (body.status !== undefined) {
      setFields.status = body.status;
      
      // If completing the milestone, set completion details
      if (body.status === 'completed') {
        setFields.completedDate = new Date();
        setFields.completedBy = userId;
      } else {
        // If changing from completed to another status, clear completion details
        setFields.completedDate = null;
        setFields.completedBy = null;
      }
    }

    if (body.notes !== undefined) {
      setFields.notes = body.notes;
    }

    // Create the update document with proper typing
    const updateDoc: UpdateFilter<MilestoneDocument> = {
      $set: setFields
    };

    // Update milestone
    const result = await db.collection<MilestoneDocument>('milestones').updateOne(
      { _id: new ObjectId(milestoneId) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Milestone not found' 
      }, { status: 404 });
    }

    // Get updated milestone
    const updatedMilestone = await db.collection<MilestoneDocument>('milestones').findOne({
      _id: new ObjectId(milestoneId)
    });

    if (!updatedMilestone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve updated milestone' 
      }, { status: 500 });
    }

    const response = transformMilestoneForResponse(updatedMilestone);

    return NextResponse.json({
      success: true,
      data: {
        milestone: response,
        message: 'Milestone updated successfully'
      }
    });

  } catch (error: unknown) {
    console.error('Error updating milestone:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}