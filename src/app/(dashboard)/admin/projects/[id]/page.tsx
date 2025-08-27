// src/app/(dashboard)/admin/projects/[id]/page.tsx - FIXED: Fully Responsive
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import ProjectDetailView from '@/components/projects/ProjectDetailView';

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Helper function to safely convert dates to ISO strings
const safeToISOString = (date: unknown): string => {
  if (!date) return '';
  try {
    return new Date(date as string | number | Date).toISOString();
  } catch (error) {
    console.warn('Invalid date:', date);
    return '';
  }
};

async function getProjectById(projectId: string) {
  if (!ObjectId.isValid(projectId)) {
    return null;
  }

  try {
    const { db } = await connectToDatabase();
    
    const project = await db.collection('projects').aggregate([
      { $match: { _id: new ObjectId(projectId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'client',
          foreignField: '_id',
          as: 'clientData',
          pipeline: [{ $project: { password: 0 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'manager',
          foreignField: '_id',
          as: 'managerData',
          pipeline: [{ $project: { password: 0 } }]
        }
      },
      {
        $addFields: {
          client: { $arrayElemAt: ['$clientData', 0] },
          manager: { $arrayElemAt: ['$managerData', 0] }
        }
      },
      { $unset: ['clientData', 'managerData'] }
    ]).toArray();

    return project[0] || null;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

export default async function AdminProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        {/* FIXED: Responsive error message */}
        <div className="text-center max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm sm:text-base text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const resolvedParams = await params;
  const project = await getProjectById(resolvedParams.id);

  if (!project) {
    notFound();
  }

  // CRITICAL FIX: Ensure all data is serializable and properly formatted
  const clientProject = {
    _id: project._id.toString(),
    title: project.title,
    description: project.description,
    client: {
      _id: project.client._id.toString(),
      name: project.client.name,
      email: project.client.email,
      role: project.client.role,
      phone: project.client.phone
    },
    manager: {
      _id: project.manager._id.toString(),
      name: project.manager.name,
      email: project.manager.email,
      role: project.manager.role,
      phone: project.manager.phone
    },
    siteAddress: project.siteAddress,
    scopeOfWork: project.scopeOfWork,
    designStyle: project.designStyle,
    status: project.status,
    priority: project.priority,
    startDate: safeToISOString(project.startDate),
    endDate: safeToISOString(project.endDate),
    projectDuration: project.projectDuration,
    budget: project.budget,
    progress: project.progress,
    siteSchedule: project.siteSchedule ? {
      phases: project.siteSchedule.phases || [],
      totalActivities: project.siteSchedule.totalActivities || 0,
      completedActivities: project.siteSchedule.completedActivities || 0
    } : undefined,
    projectCoordinator: project.projectCoordinator,
    siteOfficer: project.siteOfficer,
    workDays: project.workDays,
    files: project.files || [],
    milestones: project.milestones || [],
    tags: project.tags || [],
    notes: project.notes,
    createdAt: safeToISOString(project.createdAt),
    updatedAt: safeToISOString(project.updatedAt)
  };

  return (
    <div className="min-h-screen">
      {/* FIXED: Mobile-first responsive container */}
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6">
        <ProjectDetailView 
          project={clientProject}
          userRole={session.user.role}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}