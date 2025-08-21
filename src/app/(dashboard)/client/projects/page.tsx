// src/app/(dashboard)/client/projects/page.tsx - ENHANCED CLIENT PROJECTS PAGE
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import ProjectsList from '@/components/projects/ProjectsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Search, 
  MessageSquare, 
  Calendar,
  FileText,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

// Enhanced TypeScript interfaces for better type safety
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

interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  planning: number;
  onHold: number;
  averageProgress: number;
}

interface ClientProjectsPageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

// Client can only see their own projects
async function getClientProjects(clientId: string, searchQuery?: string): Promise<ProjectListItem[]> {
  try {
    const { db } = await connectToDatabase();
    
    // Build the filter
    const filter: Filter<ProjectDocument> = {
      client: new ObjectId(clientId)
    };

    // Add search functionality
    if (searchQuery && searchQuery.trim() !== '') {
      filter.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } }
      ];
    }

    // Execute aggregation with user details
    const projects = await db.collection<ProjectDocument>('projects')
      .aggregate<ProjectWithUsers>([
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }] // Exclude password
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }] // Exclude password
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] },
        { $sort: { updatedAt: -1 } }
      ])
      .toArray();

    // Transform to match ProjectsList component expectations
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
      startDate: project.startDate?.toISOString() || '',
      endDate: project.endDate?.toISOString() || '',
      budget: project.budget,
      progress: project.progress,
      tags: project.tags,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    }));

  } catch (error) {
    console.error('Error fetching client projects:', error);
    throw new Error('Failed to fetch projects');
  }
}

// Enhanced Quick Actions Component
function QuickActionsCard() {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {/* View Work Schedule - Updated as requested */}
          <Link href="/client/site-schedule">
            <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
              <Calendar className="h-4 w-4 mr-2" />
              View Work Schedule
            </Button>
          </Link>
          
          {/* Contact Team */}
          <Link href="/client/messages">
            <Button variant="outline" className="w-full justify-start border-blue-200 hover:bg-blue-50">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact Team
            </Button>
          </Link>
          
          {/* View Reports */}
          <Link href="/client/daily-reports">
            <Button variant="outline" className="w-full justify-start border-blue-200 hover:bg-blue-50">
              <FileText className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </Link>
        </div>
        
        {/* AI Assistant moved to bottom as requested */}
        <div className="mt-6 pt-4 border-t border-blue-200">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Need Help?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Get instant answers about your projects
              </p>
            </div>
            <Link href="/client/ai-assistant">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <MessageSquare className="h-4 w-4 mr-2" />
                AI Assistant
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Enhanced Project Insights Component
function ProjectInsightsCard({ stats }: { stats: ProjectStats }) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Project Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Completion Rate */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-green-700">{completionRate}%</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          {/* Average Progress */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-gray-600 mb-2">Average Progress</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-700">{stats.averageProgress}%</span>
                <span className="text-sm text-gray-500">across all projects</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.averageProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xl font-bold text-blue-700">{stats.active}</p>
                <p className="text-xs text-blue-600">Active</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-700">{stats.completed}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
            </div>
          </div>

          {/* Performance Indicator */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2">
              {activeRate > 60 ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-700 font-medium">High Activity</span>
                </>
              ) : activeRate > 30 ? (
                <>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-yellow-700 font-medium">Moderate Activity</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-sm text-gray-700 font-medium">Low Activity</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Based on your current project portfolio
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ClientProjectsPage({ searchParams }: ClientProjectsPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Handle search params safely
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search ? String(resolvedSearchParams.search) : '';
  
  const projects = await getClientProjects(session.user.id, searchQuery);

  // Calculate enhanced stats with proper typing
  const stats: ProjectStats = {
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
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-600 mt-1">Track the progress of your construction projects</p>
        </div>
        
        {/* Enhanced header actions - no longer showing Contact Team and AI Assistant here */}
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/daily-reports">
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Reports
            </Button>
          </Link>
          {stats.total > 0 && (
            <Link href="/client/calendar">
              <Button className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                View Calendar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Enhanced Search */}
      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="search"
                type="text"
                placeholder="Search your projects by name, description, or tags..."
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

      {/* Enhanced Stats Cards - Client focused */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
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

        <Card className="hover:shadow-md transition-shadow">
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

        <Card className="hover:shadow-md transition-shadow">
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

        <Card className="hover:shadow-md transition-shadow">
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
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Projects List - Takes up 3 columns */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'All Projects'}
              </CardTitle>
              {searchQuery && (
                <p className="text-gray-600 text-sm">
                  Found {projects.length} project{projects.length !== 1 ? 's' : ''} matching your search
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Suspense 
                fallback={
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-24 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                }
              >
                <ProjectsList 
                  projects={projects} 
                  userRole="client"
                  canCreate={false}
                  canEdit={false}
                />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Takes up 1 column */}
        <div className="space-y-6">
          {/* Quick Actions Card - Updated as requested */}
          <QuickActionsCard />
          
          {/* Project Insights */}
          {stats.total > 0 && <ProjectInsightsCard stats={stats} />}
          
          {/* Help Section */}
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Need Support?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-600 text-sm">
                  Have questions about your projects or need assistance?
                </p>
                <div className="space-y-2">
                  <Link href="/client/messages">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message Your Team
                    </Button>
                  </Link>
                  <Link href="/client/help">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      View Help Center
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Empty State for No Projects */}
      {stats.total === 0 && !searchQuery && (
        <div className="text-center py-12">
          <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Projects Yet</h3>
          <p className="text-gray-600 mb-6">
            You don&apos;t have any projects assigned to you at the moment.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/client/messages">
              <Button>
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Your Team
              </Button>
            </Link>
            <Link href="/client/help">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Empty State for Search Results */}
      {stats.total === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Results Found</h3>
          <p className="text-gray-600 mb-6">
            No projects match your search for &quot;{searchQuery}&quot;
          </p>
          <Link href="/client/projects">
            <Button>
              View All Projects
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}