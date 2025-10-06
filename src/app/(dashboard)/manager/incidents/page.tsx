// src/app/(dashboard)/manager/incidents/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import IncidentReportsClient from '@/components/incidents/IncidentReportsClient';

interface Incident {
  _id: string;
  projectId: string;
  projectTitle: string;
  incidentCode: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  dateOccurred: string;
  timeOccurred: string;
  reportedBy: {
    _id: string;
    name: string;
    email: string;
  };
  witnessNames: string[];
  injuryDetails?: {
    injuryType: string;
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved: string[];
  weatherConditions?: string;
  immediateActions: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: string;
  priority: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  photos: string[];
  documents: string[];
  followUpRequired: boolean;
  followUpDate?: string;
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

async function getManagerIncidents(managerId: string): Promise<Incident[]> {
  try {
    const { db } = await connectToDatabase();

    // Get manager's projects
    const projects = await db.collection('projects')
      .find({ manager: new ObjectId(managerId) })
      .toArray();

    if (projects.length === 0) {
      return [];
    }

    const projectIds = projects.map(p => p._id);

    // Get all incidents for manager's projects
    const incidents = await db.collection('incidents')
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
            project: { $arrayElemAt: ['$project', 0] },
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

    return incidents.map(incident => ({
      _id: incident._id.toString(),
      projectId: incident.projectId.toString(),
      projectTitle: incident.project?.title || 'Unknown Project',
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
        email: incident.reportedBy?.email || ''
      },
      witnessNames: incident.witnessNames || [],
      injuryDetails: incident.injuryDetails,
      equipmentInvolved: incident.equipmentInvolved || [],
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
      photos: incident.photos || [],
      documents: incident.documents || [],
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
    }));

  } catch (error) {
    console.error('Error fetching manager incidents:', error);
    return [];
  }
}

export default async function ManagerIncidentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'project_manager') {
    redirect('/login');
  }

  const incidents = await getManagerIncidents(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Incident Reports</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage safety incidents and project issues
          </p>
        </div>
      </div>

      <IncidentReportsClient 
        incidents={incidents} 
        userRole="project_manager"
        canEdit={true}
      />
    </div>
  );
}