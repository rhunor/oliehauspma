// src/app/api/projects/[id]/risks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface RiskDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  riskCode: string;
  riskDescription: string;
  category: 'technical' | 'financial' | 'schedule' | 'safety' | 'quality' | 'environmental' | 'legal' | 'operational';
  probability: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number;
  triggers: string[];
  mitigationStrategy: string;
  contingencyPlan: string;
  owner: ObjectId;
  status: 'identified' | 'assessed' | 'mitigated' | 'transferred' | 'accepted' | 'closed';
  reviewDate?: Date;
  lastReviewDate?: Date;
  residualProbability?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualImpact?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualScore?: number;
  comments: Array<{
    _id: ObjectId;
    userId: ObjectId;
    userName: string;
    userRole: string;
    content: string;
    createdAt: Date;
  }>;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Calculate risk score based on probability and impact
function calculateRiskScore(
  probability: string,
  impact: string
): number {
  const probabilityScores: Record<string, number> = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very_high': 5
  };

  const impactScores: Record<string, number> = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very_high': 5
  };

  return probabilityScores[probability] * impactScores[impact];
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

// GET /api/projects/[id]/risks - Get all risks for a project
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

    // Get risks with owner details
    const risks = await db.collection('risks')
      .aggregate([
        { $match: { projectId: new ObjectId(projectId) } },
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
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'creatorDetails',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            owner: { $arrayElemAt: ['$ownerDetails', 0] },
            createdBy: { $arrayElemAt: ['$creatorDetails', 0] }
          }
        },
        {
          $project: {
            ownerDetails: 0,
            creatorDetails: 0
          }
        },
        { $sort: { riskScore: -1, createdAt: -1 } }
      ])
      .toArray();

    // Transform for client
    const clientRisks = risks.map(risk => ({
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
        email: risk.owner.email,
        role: risk.owner.role
      },
      status: risk.status,
      reviewDate: risk.reviewDate?.toISOString(),
      lastReviewDate: risk.lastReviewDate?.toISOString(),
      residualProbability: risk.residualProbability,
      residualImpact: risk.residualImpact,
      residualScore: risk.residualScore,
      comments: risk.comments?.map((comment: RiskDocument['comments'][0]) => ({
        _id: comment._id.toString(),
        userId: comment.userId.toString(),
        userName: comment.userName,
        userRole: comment.userRole,
        content: comment.content,
        createdAt: comment.createdAt.toISOString()
      })) || [],
      createdBy: {
        _id: risk.createdBy._id.toString(),
        name: risk.createdBy.name,
        email: risk.createdBy.email
      },
      createdAt: risk.createdAt.toISOString(),
      updatedAt: risk.updatedAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: clientRisks
    });

  } catch (error: unknown) {
    console.error('Error fetching risks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/risks - Create new risk
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

    // Only admins and managers can create risks
    if (!['super_admin', 'project_manager'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: 'Only administrators and project managers can create risks'
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
      riskDescription,
      category,
      probability,
      impact,
      triggers,
      mitigationStrategy,
      contingencyPlan,
      ownerId,
      reviewDate
    } = body;

    // Validate required fields
    if (!riskDescription || !category || !probability || !impact || !mitigationStrategy || !ownerId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    if (!ObjectId.isValid(ownerId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid owner ID'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify owner exists
    const owner = await db.collection('users').findOne({
      _id: new ObjectId(ownerId)
    });

    if (!owner) {
      return NextResponse.json({
        success: false,
        error: 'Owner not found'
      }, { status: 404 });
    }

    // Generate risk code
    const riskCount = await db.collection('risks').countDocuments({
      projectId: new ObjectId(projectId)
    });
    const riskCode = `RISK-${String(riskCount + 1).padStart(4, '0')}`;

    // Calculate risk score
    const riskScore = calculateRiskScore(probability, impact);

    const riskData: RiskDocument = {
      projectId: new ObjectId(projectId),
      riskCode,
      riskDescription,
      category,
      probability,
      impact,
      riskScore,
      triggers: triggers || [],
      mitigationStrategy,
      contingencyPlan: contingencyPlan || '',
      owner: new ObjectId(ownerId),
      status: 'identified',
      reviewDate: reviewDate ? new Date(reviewDate) : undefined,
      comments: [],
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('risks').insertOne(riskData);

    // Get created risk with owner details
    const createdRisk = await db.collection('risks')
      .aggregate([
        { $match: { _id: result.insertedId } },
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

    const risk = createdRisk[0];

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
        comments: [],
        createdAt: risk.createdAt.toISOString(),
        updatedAt: risk.updatedAt.toISOString()
      },
      message: 'Risk created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating risk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}