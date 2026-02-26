// src/app/(dashboard)/manager/projects/page.tsx - FIXED WITH PROPER SERIALIZATION
import { Suspense } from 'react';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import ProjectsList from '@/components/projects/ProjectsList';

import { Card, CardContent } from '@/components/ui/card';
import { FolderOpen, Users, Clock, CheckCircle } from 'lucide-react';

// Define the MongoDB document structure (raw document from database)
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId;
  manager: ObjectId;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Define the aggregated document structure (after lookup joins)
interface ProjectDocumentFromDB {
  _id: ObjectId;
  title: string;
  description: string;
  client: {
    _id: ObjectId;
    name: string;
    email: string;
  };
  manager?: {
    _id: ObjectId;
    name: string;
    email: string;
  } | null;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Define the Project interface that can be safely passed to client components
interface Project {
  _id: string;
  title: string;
  description: string;
  client: {
    _id: string;
    name: string;
    email: string;
  };
  manager: {
    _id: string;
    name: string;
    email: string;
  } | null;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Manager can only see and manage their own projects
async function getManagerProjects(managerId: string): Promise<Project[]> {
  const { db } = await connectToDatabase();
  
  // ✅ Fix: Use proper Filter type instead of any
  const filter: Filter<ProjectDocument> = {
    manager: new ObjectId(managerId)
  };

  const rawProjects = await db.collection('projects')
    .aggregate([
      { $match: filter },
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
      { $sort: { createdAt: -1 } },
      { $limit: 100 }
    ])
    .toArray() as ProjectDocumentFromDB[];

  // Transform MongoDB documents to plain objects for client components
  return rawProjects.map(project => ({
    _id: project._id.toString(),
    title: project.title,
    description: project.description,
    client: {
      _id: project.client._id.toString(),
      name: project.client.name,
      email: project.client.email
    },
    manager: project.manager ? {
      _id: project.manager._id.toString(),
      name: project.manager.name,
      email: project.manager.email
    } : null,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    tags: project.tags,
    budget: project.budget,
    startDate: project.startDate?.toISOString() || '',
    endDate: project.endDate?.toISOString() || '',
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  }));
}

export default async function ManagerProjectsPage() {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== 'project_manager') {
    return <div>Access denied</div>;
  }

  const projects = await getManagerProjects(session.user.id);

  // Calculate stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planning: projects.filter(p => p.status === 'planning').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-600 mt-1">Manage and track your assigned projects</p>
        </div>
        {/* Note: Only super_admin can create projects, so hide this button */}
        {/* <CreateProjectButton /> */}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Planning</p>
                <p className="text-3xl font-bold text-gray-900">{stats.planning}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectsList 
          projects={projects} 
          userRole="project_manager"
          canCreate={false} // Managers cannot create projects
          canEdit={true}    // Managers can edit their projects
        />
      </Suspense>
    </div>
  );
}