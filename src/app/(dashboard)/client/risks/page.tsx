// src/app/(dashboard)/client/risks/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import RiskAssessmentClient from '@/components/risks/RiskAssessmentClient';

interface Risk {
  _id: string;
  projectId: string;
  projectTitle: string;
  riskCode: string;
  riskDescription: string;
  category: string;
  probability: string;
  impact: string;
  riskScore: number;
  triggers: string[];
  mitigationStrategy: string;
  contingencyPlan: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  status: string;
  reviewDate?: string;
  lastReviewDate?: string;
  residualProbability?: string;
  residualImpact?: string;
  residualScore?: number;
  comments: Array<{
    _id: string;
    userId: string;
    userName: string;
    userRole: string;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

async function getClientRisks(clientId: string): Promise<Risk[]> {
  try {
    const { db } = await connectToDatabase();

    // Get client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .toArray();

    if (projects.length === 0) {
      return [];
    }

    const projectIds = projects.map(p => p._id);

    // Get all risks for client's projects
    const risks = await db.collection('risks')
      .aggregate([
        { $match: { projectId: { $in: projectIds } } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
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
            project: { $arrayElemAt: ['$project', 0] },
            owner: { $arrayElemAt: ['$ownerDetails', 0] }
          }
        },
        {
          $project: {
            ownerDetails: 0
          }
        },
        { $sort: { riskScore: -1, createdAt: -1 } }
      ])
      .toArray();

    return risks.map(risk => ({
      _id: risk._id.toString(),
      projectId: risk.projectId.toString(),
      projectTitle: risk.project?.title || 'Unknown Project',
      riskCode: risk.riskCode,
      riskDescription: risk.riskDescription,
      category: risk.category,
      probability: risk.probability,
      impact: risk.impact,
      riskScore: risk.riskScore,
      triggers: risk.triggers || [],
      mitigationStrategy: risk.mitigationStrategy,
      contingencyPlan: risk.contingencyPlan || '',
      owner: {
        _id: risk.owner?._id.toString() || '',
        name: risk.owner?.name || 'Unknown',
        email: risk.owner?.email || ''
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
    }));

  } catch (error) {
    console.error('Error fetching client risks:', error);
    return [];
  }
}

export default async function ClientRisksPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'client') {
    redirect('/login');
  }

  const risks = await getClientRisks(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Risk Assessment</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            View and track project risks and mitigation strategies
          </p>
        </div>
      </div>

      <RiskAssessmentClient 
        risks={risks} 
        userRole="client"
        canEdit={false}
      />
    </div>
  );
}