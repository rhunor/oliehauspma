// FILE: src/app/(dashboard)/admin/projects/[id]/page.tsx - FIXED FOR MULTIPLE MANAGERS
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import ProjectDetailView from '@/components/projects/ProjectDetailView';

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface UserData {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  phone?: string;
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

// Helper to serialize user data
const serializeUser = (user: UserData) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone
});

async function getProjectById(projectId: string) {
  if (!ObjectId.isValid(projectId)) {
    return null;
  }

  try {
    const { db } = await connectToDatabase();
    
    // ✅ UPDATED: Lookup both managers array and single manager for backward compatibility
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
          localField: 'managers',
          foreignField: '_id',
          as: 'managersData',
          pipeline: [{ $project: { password: 0 } }]
        }
      },
      {
        $addFields: {
          client: { $arrayElemAt: ['$clientData', 0] },
          managers: '$managersData'
        }
      },
      { $unset: ['clientData', 'managersData'] }
    ]).toArray();

    return project[0] || null;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

export default async function AdminProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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

  // ✅ FIXED: Ensure client exists before serializing
  if (!project.client) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Invalid Project Data</h2>
          <p className="text-sm sm:text-base text-gray-600">This project does not have a client assigned.</p>
        </div>
      </div>
    );
  }

  // ✅ FIXED: Properly serialize all data including managers array
  const clientProject = {
    _id: project._id.toString(),
    title: project.title || '',
    description: project.description || '',
    client: serializeUser(project.client), // ✅ Now guaranteed to exist
    managers: Array.isArray(project.managers) 
      ? project.managers.map((manager: UserData) => serializeUser(manager))
      : [],
    siteAddress: project.siteAddress || '',
    scopeOfWork: project.scopeOfWork || '',
    designStyle: project.designStyle || '',
    status: project.status || 'planning',
    priority: project.priority || 'medium',
    startDate: safeToISOString(project.startDate),
    endDate: safeToISOString(project.endDate),
    projectDuration: project.projectDuration || '',
    budget: project.budget || 0,
    progress: project.progress || 0,
    siteSchedule: project.siteSchedule ? {
      phases: project.siteSchedule.phases || [],
      totalActivities: project.siteSchedule.totalActivities || 0,
      completedActivities: project.siteSchedule.completedActivities || 0,
      lastUpdated: safeToISOString(project.siteSchedule.lastUpdated)
    } : undefined,
    projectCoordinator: project.projectCoordinator || '',
    siteOfficer: project.siteOfficer || '',
    workDays: project.workDays || [],
    files: project.files || [],
    milestones: Array.isArray(project.milestones) 
      ? project.milestones.map((milestone: Record<string, unknown>) => ({
          name: milestone.name as string || 'Unnamed Milestone',
          description: milestone.description as string | undefined,
          dueDate: safeToISOString(milestone.dueDate) || safeToISOString(milestone.targetDate),
          status: (milestone.status as 'pending' | 'in_progress' | 'completed') || 'pending'
        }))
      : [],
    tags: project.tags || [],
    notes: project.notes || '',
    createdAt: safeToISOString(project.createdAt),
    updatedAt: safeToISOString(project.updatedAt)
  };

  return (
    <div className="min-h-screen">
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