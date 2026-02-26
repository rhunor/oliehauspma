// src/app/api/projects/[id]/risks/[riskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
    riskId: string;
  }>;
}

// Calculate risk score
function calculateRiskScore(probability: string, impact: string): number {
  const scores: Record<string, number> = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very_high': 5
  };
  return scores[probability] * scores[impact];
}

// PATCH /api/projects/[id]/risks/[riskId] - Update risk
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
    const { id: projectId, riskId } = params;

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(riskId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ID'
      }, { status: 400 });
    }

    // Only admins and managers can update risks
    if (!['super_admin', 'project_manager'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Only administrators and project managers can update risks'
      }, { status: 403 });
    }

    const body = await request.json();
    const { db } = await connectToDatabase();

    // Get existing risk
    const existingRisk = await db.collection('risks').findOne({
      _id: new ObjectId(riskId),
      projectId: new ObjectId(projectId)
    });

    if (!existingRisk) {
      return NextResponse.json({
        success: false,
        error: 'Risk not found'
      }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    // Update fields if provided
    if (body.riskDescription !== undefined) updateData.riskDescription = body.riskDescription;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.probability !== undefined) updateData.probability = body.probability;
    if (body.impact !== undefined) updateData.impact = body.impact;
    if (body.triggers !== undefined) updateData.triggers = body.triggers;
    if (body.mitigationStrategy !== undefined) updateData.mitigationStrategy = body.mitigationStrategy;
    if (body.contingencyPlan !== undefined) updateData.contingencyPlan = body.contingencyPlan;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.reviewDate !== undefined) updateData.reviewDate = new Date(body.reviewDate);
    if (body.residualProbability !== undefined) updateData.residualProbability = body.residualProbability;
    if (body.residualImpact !== undefined) updateData.residualImpact = body.residualImpact;
    
    if (body.ownerId !== undefined) {
      if (!ObjectId.isValid(body.ownerId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid owner ID'
        }, { status: 400 });
      }
      updateData.owner = new ObjectId(body.ownerId);
    }

    // Recalculate risk score if probability or impact changed
    const newProbability = body.probability || existingRisk.probability;
    const newImpact = body.impact || existingRisk.impact;
    updateData.riskScore = calculateRiskScore(newProbability, newImpact);

    // Calculate residual score if residual values provided
    if (body.residualProbability && body.residualImpact) {
      updateData.residualScore = calculateRiskScore(
        body.residualProbability,
        body.residualImpact
      );
    }

    // Update last review date if status changed
    if (body.status && body.status !== existingRisk.status) {
      updateData.lastReviewDate = new Date();
    }

    await db.collection('risks').updateOne(
      { _id: new ObjectId(riskId) },
      { $set: updateData }
    );

    // Get updated risk
    const updatedRisk = await db.collection('risks')
      .aggregate([
        { $match: { _id: new ObjectId(riskId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerDetails',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            owner: { $arrayElemAt: ['$ownerDetails', 0] }
          }
        },
        {
          $project: { ownerDetails: 0 }
        }
      ])
      .toArray();

    const risk = updatedRisk[0];

    return NextResponse.json({
      success: true,
      data: {
        _id: risk._id.toString(),
        projectId: risk.projectId.toString(),
        riskCode: risk.riskCode,
        riskDescription: risk.riskDescription,
        category: risk.category,
        probability: risk.probability,
        impact: risk.impact,
        riskScore: risk.riskScore,
        triggers: risk.triggers,
        mitigationStrategy: risk.mitigationStrategy,
        contingencyPlan: risk.contingencyPlan,
        owner: {
          _id: risk.owner._id.toString(),
          name: risk.owner.name,
          email: risk.owner.email
        },
        status: risk.status,
        reviewDate: risk.reviewDate?.toISOString(),
        lastReviewDate: risk.lastReviewDate?.toISOString(),
        residualProbability: risk.residualProbability,
        residualImpact: risk.residualImpact,
        residualScore: risk.residualScore,
        comments: risk.comments?.map((comment: {
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
        createdAt: risk.createdAt.toISOString(),
        updatedAt: risk.updatedAt.toISOString()
      },
      message: 'Risk updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating risk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/risks/[riskId] - Delete risk
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
    const { id: projectId, riskId } = params;

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(riskId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ID'
      }, { status: 400 });
    }

    // Only super admins can delete risks
    if (session.user.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Only administrators can delete risks'
      }, { status: 403 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('risks').deleteOne({
      _id: new ObjectId(riskId),
      projectId: new ObjectId(projectId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Risk not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Risk deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting risk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}