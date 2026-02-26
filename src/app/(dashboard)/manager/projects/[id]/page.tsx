// src/app/(dashboard)/manager/projects/[id]/page.tsx - FIXED WITH MULTIPLE MANAGERS
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import ProjectDetailView from '@/components/projects/ProjectDetailView';
import { Card, CardContent } from '@/components/ui/card';

// Complete type definitions
interface SiteActivity {
  title: string;
  contractor: string;
  plannedDate: Date | string;
  actualDate?: Date | string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  comments?: string;
  images?: string[];
  incidentReport?: string;
  supervisor?: string;
  dependencies?: string[];
  duration?: number;
}

interface SiteDay {
  date: Date | string;
  dayNumber: number;
  activities: SiteActivity[];
}

interface SiteWeek {
  weekNumber: number;
  title: string;
  startDate: Date | string;
  endDate: Date | string;
  days: SiteDay[];
}

interface SitePhase {
  name: string;
  description?: string;
  weeks: SiteWeek[];
}

interface SiteSchedule {
  phases: SitePhase[];
  totalActivities: number;
  completedActivities: number;
}

interface ProjectFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: Date | string;
  uploadedBy: ObjectId | string;
  size?: number;
  category?: string;
  tags?: string[];
  description?: string;
}

interface ProjectMilestone {
  name: string;
  description?: string;
  dueDate: Date | string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId;
  managers: ObjectId[]; // FIXED: Changed from manager to managers array
  siteAddress: string;
  scopeOfWork?: string;
  designStyle?: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  projectDuration?: string;
  budget?: number;
  progress: number;
  siteSchedule?: SiteSchedule;
  projectCoordinator?: {
    name: string;
    phone: string;
  };
  siteOfficer?: {
    name: string;
    phone: string;
  };
  workDays?: string;
  files: ProjectFile[];
  milestones: ProjectMilestone[];
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

// FIXED: Updated interface to have managers array instead of single manager
interface ProjectWithUsers extends Omit<ProjectDocument, 'client' | 'managers'> {
  client: UserDocument;
  managers: UserDocument[]; // FIXED: Array of managers
}

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

// Helper functions
function safeToISOString(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;
  
  try {
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    
    return undefined;
  } catch (error) {
    console.error('Error converting date to ISO string:', error);
    return undefined;
  }
}

function safeObjectIdToString(id: ObjectId | string | undefined | null): string {
  if (!id) return '';
  return typeof id === 'string' ? id : id.toString();
}

async function getProjectById(projectId: string, userRole: string, userId: string): Promise<ProjectWithUsers | null> {
  try {
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(projectId)) {
      return null;
    }

    // FIXED: Manager can only see projects where they are in the managers array
    const accessFilter = { 
      managers: { $in: [new ObjectId(userId)] } // Check if userId is in managers array
    };

    const project = await db.collection('projects')
      .aggregate<ProjectWithUsers>([
        { 
          $match: { 
            _id: new ObjectId(projectId),
            ...accessFilter
          } 
        },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        // FIXED: Lookup managers array - MongoDB 5.0+ supports direct lookup on arrays
        {
          $lookup: {
            from: 'users',
            localField: 'managers',
            foreignField: '_id',
            as: 'managersData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        // CRITICAL FIX: Properly fetch files without binary data
        {
          $lookup: {
            from: 'files',
            localField: '_id',
            foreignField: 'projectId',
            as: 'fileDocuments',
            pipeline: [
              { 
                $project: { 
                  filename: 1, 
                  originalName: 1, 
                  size: 1, 
                  mimeType: 1, 
                  url: 1, 
                  uploadedAt: 1, 
                  uploadedBy: 1,
                  category: 1,
                  tags: 1,
                  description: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            managers: '$managersData', // FIXED: Keep as array, don't use $arrayElemAt
            // CRITICAL FIX: Transform files to proper format
            files: {
              $map: {
                input: { $ifNull: ['$fileDocuments', []] },
                as: 'file',
                in: {
                  name: { $ifNull: ['$$file.originalName', '$$file.filename', 'Unknown File'] },
                  url: { $ifNull: ['$$file.url', ''] },
                  type: { $ifNull: ['$$file.mimeType', 'application/octet-stream'] },
                  uploadedAt: { $ifNull: ['$$file.uploadedAt', new Date()] },
                  uploadedBy: { $ifNull: ['$$file.uploadedBy', null] },
                  size: { $ifNull: ['$$file.size', 0] },
                  category: { $ifNull: ['$$file.category', 'other'] },
                  tags: { $ifNull: ['$$file.tags', []] },
                  description: { $ifNull: ['$$file.description', ''] }
                }
              }
            }
          }
        },
        { $unset: ['clientData', 'managersData', 'fileDocuments'] }
      ])
      .toArray();

    return project[0] || null;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ManagerProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== 'project_manager') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const resolvedParams = await params;
  const project = await getProjectById(resolvedParams.id, session.user.role, session.user.id);

  if (!project) {
    notFound();
  }

  // CRITICAL FIX: Ensure all data is serializable and properly formatted with multiple managers
  const managerProject = {
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
    // FIXED: Map managers array properly with explicit properties
    managers: (project.managers || []).map((manager) => ({
      _id: manager._id.toString(),
      name: manager.name,
      email: manager.email,
      role: manager.role,
      phone: manager.phone
    })),
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
      totalActivities: project.siteSchedule.totalActivities,
      completedActivities: project.siteSchedule.completedActivities,
      phases: (project.siteSchedule.phases || []).map((phase: SitePhase) => ({
        name: phase.name,
        description: phase.description,
        weeks: (phase.weeks || []).map((week: SiteWeek) => ({
          weekNumber: week.weekNumber,
          title: week.title,
          startDate: safeToISOString(week.startDate) || '',
          endDate: safeToISOString(week.endDate) || '',
          days: (week.days || []).map((day: SiteDay) => ({
            date: safeToISOString(day.date) || '',
            dayNumber: day.dayNumber,
            activities: (day.activities || []).map((activity: SiteActivity) => ({
              title: activity.title,
              contractor: activity.contractor,
              plannedDate: safeToISOString(activity.plannedDate) || '',
              actualDate: safeToISOString(activity.actualDate),
              status: activity.status,
              comments: activity.comments,
              images: activity.images,
              incidentReport: activity.incidentReport,
              supervisor: activity.supervisor,
              dependencies: activity.dependencies,
              duration: activity.duration
            }))
          }))
        }))
      }))
    } : undefined,
    projectCoordinator: project.projectCoordinator,
    siteOfficer: project.siteOfficer,
    workDays: project.workDays,
    // CRITICAL FIX: Ensure files are properly typed with defensive checks
    files: (project.files || []).map((file) => ({
      name: file.name || 'Unknown File',
      url: file.url || '',
      type: file.type || 'application/octet-stream',
      uploadedAt: safeToISOString(file.uploadedAt) || '',
      uploadedBy: safeObjectIdToString(file.uploadedBy),
      size: file.size || 0,
      category: file.category || 'other',
      tags: file.tags || [],
      description: file.description || ''
    })),
    milestones: (project.milestones || []).map((milestone: ProjectMilestone) => ({
      name: milestone.name,
      description: milestone.description,
      dueDate: safeToISOString(milestone.dueDate) || '',
      status: milestone.status
    })),
    tags: project.tags || [],
    notes: project.notes,
    createdAt: safeToISOString(project.createdAt) || '',
    updatedAt: safeToISOString(project.updatedAt) || ''
  };

  return (
    <Suspense fallback={<ProjectDetailLoading />}>
      <ProjectDetailView 
        project={managerProject}
        userRole={session.user.role}
        userId={session.user.id}
      />
    </Suspense>
  );
}