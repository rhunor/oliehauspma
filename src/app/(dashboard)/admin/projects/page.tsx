// src/app/(dashboard)/admin/projects/page.tsx
import { Suspense } from 'react';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import ProjectsList from '@/components/projects/ProjectsList';
import CreateProjectButton from '@/components/projects/CreateProjectButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, Users, Clock, CheckCircle } from 'lucide-react';

// Define types for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string; // Required, not optional
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent'; // Required, not optional
  client: ObjectId;
  manager: ObjectId;
  startDate: Date;
  endDate: Date;
  progress: number;
  budget?: number; // Optional in ProjectsList
  tags: string[]; // Required, not optional
  createdAt: Date;
  updatedAt: Date; // Required in ProjectsList
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  password?: string; // Excluded in projection
}

// Define aggregation result types
interface ProjectWithUsers extends Omit<ProjectDocument, 'client' | 'manager'> {
  client: UserDocument;
  manager: UserDocument;
}

// Define the ProjectItem interface that exactly matches what ProjectsList expects
interface ProjectItem {
  _id: string;
  title: string;
  description: string; // Required
  client: {
    _id: string;
    name: string;
    email: string;
  };
  manager: {
    _id: string;
    name: string;
    email: string;
  };
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent'; // Required
  startDate: string;
  endDate: string;
  budget?: number; // Optional
  progress: number;
  tags: string[]; // Required
  createdAt: string;
  updatedAt: string; // Required
}

interface ProjectStats {
  _id: null;
  total: number;
  active: number;
  completed: number;
  overdue: number;
}

interface ProjectsData {
  projects: ProjectItem[];
  stats: ProjectStats;
}

async function getProjectsData(userId: string, userRole: string): Promise<ProjectsData> {
  const { db } = await connectToDatabase();

  // Build query based on user role with proper typing
  const matchQuery: Filter<ProjectDocument> = {};
  
  if (userRole === 'client') {
    matchQuery.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    matchQuery.manager = new ObjectId(userId);
  }
  // super_admin can see all projects (no filter)

  // Get projects with populated client and manager data
  const projects = await db.collection<ProjectDocument>('projects')
    .aggregate<ProjectWithUsers>([
      { $match: matchQuery },
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
      { $unset: ['clientData', 'managerData'] },
      { $sort: { createdAt: -1 } }
    ])
    .toArray();

  // Get project statistics
  const stats = await db.collection<ProjectDocument>('projects').aggregate<ProjectStats>([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [
              { $in: ['$status', ['planning', 'in_progress']] },
              1,
              0
            ]
          }
        },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$endDate', new Date()] },
                  { $ne: ['$status', 'completed'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]).toArray();

  const projectStats: ProjectStats = stats[0] || { 
    _id: null, 
    total: 0, 
    active: 0, 
    completed: 0, 
    overdue: 0 
  };

  return {
    projects: JSON.parse(JSON.stringify(projects)) as ProjectItem[],
    stats: projectStats
  };
}

export default async function ProjectsPage() {
  const session = await auth();
  
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const { projects, stats } = await getProjectsData(session.user.id, session.user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            Manage and track your interior design projects.
          </p>
        </div>
        {(session.user.role === 'super_admin' || session.user.role === 'project_manager') && (
          <CreateProjectButton />
        )}
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectsList projects={projects} userRole={session.user.role} />
      </Suspense>
    </div>
  );
}