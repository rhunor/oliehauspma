// src/app/(dashboard)/client/projects/page.tsx - FIXED WITH PROPER TYPES
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import ProjectsList from '@/components/projects/ProjectsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, Clock, CheckCircle, TrendingUp, Search, MessageSquare, Bot } from 'lucide-react';
import Link from 'next/link';

// Define the MongoDB document structure
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

// Define the aggregated result structure
interface ProjectWithUsers {
  _id: ObjectId;
  title: string;
  description: string;
  client: {
    _id: ObjectId;
    name: string;
    email: string;
  };
  manager: {
    _id: ObjectId;
    name: string;
    email: string;
  };
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

// Define the interface that matches ProjectsList component expectations
interface ProjectListItem {
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
  };
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

// Client can only see their own projects
async function getClientProjects(clientId: string, searchQuery?: string): Promise<ProjectListItem[]> {
  const { db } = await connectToDatabase();
  
  const filter: Filter<ProjectDocument> = {
    client: new ObjectId(clientId)
  };

  // Add search functionality
  if (searchQuery && searchQuery.trim()) {
    filter.$or = [
      { title: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { tags: { $regex: searchQuery, $options: 'i' } }
    ];
  }

  const projects = await db.collection<ProjectDocument>('projects')
    .aggregate<ProjectWithUsers>([
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
      { $sort: { createdAt: -1 } }
    ])
    .toArray() as ProjectWithUsers[]; // Type assertion to fix the Document[] issue

  // Transform to match ProjectsList interface
  return projects.map(project => ({
    _id: project._id.toString(),
    title: project.title,
    description: project.description,
    client: {
      _id: project.client._id.toString(),
      name: project.client.name,
      email: project.client.email
    },
    manager: {
      _id: project.manager._id.toString(),
      name: project.manager.name,
      email: project.manager.email
    },
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    tags: project.tags,
    startDate: project.startDate?.toISOString() || '',
    endDate: project.endDate?.toISOString() || '',
    budget: project.budget,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  }));
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ClientProjectsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const searchQuery = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : '';
  
  const projects = await getClientProjects(session.user.id, searchQuery);

  // Calculate stats with proper typing
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planning: projects.filter(p => p.status === 'planning').length,
    onHold: projects.filter(p => p.status === 'on_hold').length,
    averageProgress: projects.length > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
      : 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-600 mt-1">Track the progress of your design projects</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/messages">
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact Team
            </Button>
          </Link>
          <Link href="/client/support">
            <Button className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Assistant
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="search"
                type="text"
                placeholder="Search your projects..."
                defaultValue={searchQuery}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            {searchQuery && (
              <Link href="/client/projects">
                <Button variant="outline">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Stats Cards - Client focused */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Your Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-blue-600 font-medium">{stats.active} active</span>
              <span className="text-gray-500 ml-2">• {stats.completed} completed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-orange-600 font-medium">In progress</span>
              {stats.planning > 0 && (
                <span className="text-gray-500 ml-2">• {stats.planning} planning</span>
              )}
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
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">Finished projects</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Progress</p>
                <p className="text-3xl font-bold text-gray-900">{stats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.averageProgress}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List - Client view (read-only) */}
      <Suspense fallback={
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      }>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No projects found' : 'No projects yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery 
                    ? `No projects match "${searchQuery}". Try adjusting your search.`
                    : "You don&apos;t have any projects yet. Contact us to get started with your design journey!"
                  }
                </p>
                <div className="flex justify-center gap-3">
                  {searchQuery && (
                    <Link href="/client/projects">
                      <Button variant="outline">View All Projects</Button>
                    </Link>
                  )}
                  <Link href="/client/messages">
                    <Button>Contact Team</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ProjectsList 
            projects={projects} 
            userRole="client"
            canCreate={false} // Clients cannot create projects
            canEdit={false}   // Clients cannot edit projects
          />
        )}
      </Suspense>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <MessageSquare className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Contact Your Team</h3>
              <p className="text-sm text-gray-600 mb-3">
                Have questions about your project? Message your project manager directly.
              </p>
              <Link href="/client/messages">
                <Button size="sm">Send Message</Button>
              </Link>
            </div>

            <div className="text-center">
              <Bot className="h-8 w-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">AI Assistant</h3>
              <p className="text-sm text-gray-600 mb-3">
                Get instant answers to common questions about your project.
              </p>
              <Link href="/client/support">
                <Button size="sm" variant="outline">Ask AI</Button>
              </Link>
            </div>

            <div className="text-center">
              <FolderOpen className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">View Files</h3>
              <p className="text-sm text-gray-600 mb-3">
                Access all project files, designs, and documents.
              </p>
              <Link href="/client/files">
                <Button size="sm" variant="outline">Browse Files</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}