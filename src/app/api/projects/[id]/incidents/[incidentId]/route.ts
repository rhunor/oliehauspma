// src/app/api/projects/[id]/incidents/[incidentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
    incidentId: string;
  }>;
}

// PATCH /api/projects/[id]/incidents/[incidentId] - Update incident
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const params = await context.params;
    const { id: projectId, incidentId } = params;

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(incidentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ID'
      }, { status: 400 });
    }

    // Only admins and managers can update incidents
    if (!['super_admin', 'project_manager'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Only administrators and project managers can update incident reports'
      }, { status: 403 });
    }

    const body = await request.json();
    const { db } = await connectToDatabase();

    // Get existing incident
    const existingIncident = await db.collection('incidents').findOne({
      _id: new ObjectId(incidentId),
      projectId: new ObjectId(projectId)
    });

    if (!existingIncident) {
      return NextResponse.json({
        success: false,
        error: 'Incident not found'
      }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    // Update fields if provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.dateOccurred !== undefined) updateData.dateOccurred = new Date(body.dateOccurred);
    if (body.timeOccurred !== undefined) updateData.timeOccurred = body.timeOccurred;
    if (body.witnessNames !== undefined) updateData.witnessNames = body.witnessNames;
    if (body.injuryDetails !== undefined) updateData.injuryDetails = body.injuryDetails;
    if (body.equipmentInvolved !== undefined) updateData.equipmentInvolved = body.equipmentInvolved;
    if (body.weatherConditions !== undefined) updateData.weatherConditions = body.weatherConditions;
    if (body.immediateActions !== undefined) updateData.immediateActions = body.immediateActions;
    if (body.rootCause !== undefined) updateData.rootCause = body.rootCause;
    if (body.correctiveActions !== undefined) updateData.correctiveActions = body.correctiveActions;
    if (body.preventiveActions !== undefined) updateData.preventiveActions = body.preventiveActions;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.photos !== undefined) updateData.photos = body.photos;
    if (body.documents !== undefined) updateData.documents = body.documents;
    if (body.followUpRequired !== undefined) updateData.followUpRequired = body.followUpRequired;
    if (body.followUpDate !== undefined) updateData.followUpDate = new Date(body.followUpDate);
    
    if (body.assignedToId !== undefined) {
      if (body.assignedToId && !ObjectId.isValid(body.assignedToId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid assignee ID'
        }, { status: 400 });
      }
      updateData.assignedTo = body.assignedToId ? new ObjectId(body.assignedToId) : null;
    }

    await db.collection('incidents').updateOne(
      { _id: new ObjectId(incidentId) },
      { $set: updateData }
    );

    // Get updated incident
    const updatedIncident = await db.collection('incidents')
      .aggregate([
        { $match: { _id: new ObjectId(incidentId) } },
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
        }
      ])
      .toArray();

    const incident = updatedIncident[0];

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
        assignedTo: incident.assignedTo ? {
          _id: incident.assignedTo._id.toString(),
          name: incident.assignedTo.name,
          email: incident.assignedTo.email
        } : undefined,
        photos: incident.photos,
        documents: incident.documents,
        followUpRequired: incident.followUpRequired,
        followUpDate: incident.followUpDate?.toISOString(),
        comments: incident.comments?.map((comment: {
          _id: ObjectId;
          userId: ObjectId;
          userName: string;
          userRole: string;
          content: string;
          createdAt: Date;
        }) => ({
          _id: comment._id.toString(),
          userId: comment.userId.toString(),
          userName: comment.userName,
          userRole: comment.userRole,
          content: comment.content,
          createdAt: comment.createdAt.toISOString()
        })) || [],
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString()
      },
      message: 'Incident updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating incident:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/incidents/[incidentId] - Delete incident
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const params = await context.params;
    const { id: projectId, incidentId } = params;

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(incidentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ID'
      }, { status: 400 });
    }

    // Only super admins can delete incidents
    if (session.user.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Only administrators can delete incident reports'
      }, { status: 403 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('incidents').deleteOne({
      _id: new ObjectId(incidentId),
      projectId: new ObjectId(projectId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Incident not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting incident:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}