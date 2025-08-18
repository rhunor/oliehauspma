// src/components/projects/ProjectsList.tsx - FIXED WITH ROLE-BASED ROUTING
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Search,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { formatDate, formatCurrency } from '@/lib/utils';

interface ProjectClient {
  _id: string;
  name: string;
  email: string;
}

interface ProjectManager {
  _id: string;
  name: string;
  email: string;
}

interface Project {
  _id: string;
  title: string;
  description: string;
  client: ProjectClient;
  manager: ProjectManager;
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

interface ProjectsListProps {
  projects: Project[];
  userRole: 'super_admin' | 'project_manager' | 'client';
  canCreate?: boolean;
  canEdit?: boolean;
}

// ✅ FIXED: Role-based URL generation function
const getRoleBasedProjectUrl = (userRole: string, projectId: string, action: 'view' | 'edit' = 'view'): string => {
  const baseRoutes = {
    super_admin: '/admin',
    project_manager: '/manager',
    client: '/client'
  };
  
  const baseRoute = baseRoutes[userRole as keyof typeof baseRoutes] || '/admin';
  
  if (action === 'edit') {
    return `${baseRoute}/projects/${projectId}/edit`;
  }
  
  return `${baseRoute}/projects/${projectId}`;
};

// ✅ FIXED: Role-based create URL function
const getRoleBasedCreateUrl = (userRole: string): string => {
  const baseRoutes = {
    super_admin: '/admin',
    project_manager: '/manager',
    client: '/client'
  };
  
  const baseRoute = baseRoutes[userRole as keyof typeof baseRoutes] || '/admin';
  return `${baseRoute}/projects/new`;
};

export default function ProjectsList({ 
  projects, 
  userRole, 
  canCreate = false,
  canEdit = true
}: ProjectsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.client.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'progress':
          return b.progress - a.progress;
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

  // ✅ Helper functions to avoid code duplication
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'planning':
        return 'outline';
      case 'on_hold':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'in_progress':
        return <Clock className="h-3 w-3" />;
      case 'planning':
        return <Calendar className="h-3 w-3" />;
      case 'on_hold':
      case 'cancelled':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Calendar className="h-3 w-3" />;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'outline';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const isOverdue = (endDate: string, status: string): boolean => {
    if (status === 'completed' || !endDate) return false;
    return new Date(endDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'client' 
              ? 'View your project progress and updates'
              : 'Manage and track all projects'
            }
          </p>
        </div>
        
        {/* ✅ FIXED: Now using role-based create URL */}
        {canCreate && (
          <Link href={getRoleBasedCreateUrl(userRole)}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Create your first project to get started.'}
            </p>
            
            {/* ✅ FIXED: Show create button with role-based URL in empty state */}
            {canCreate && !searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
              <Link href={getRoleBasedCreateUrl(userRole)}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project._id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2 line-clamp-2">
                      {/* ✅ FIXED: Main project title now uses role-based URL */}
                      <Link 
                        href={getRoleBasedProjectUrl(userRole, project._id)}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {project.title}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {project.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {isOverdue(project.endDate, project.status) && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    
                    {((userRole === 'super_admin' || userRole === 'project_manager') && canEdit) && (
                      <div className="relative group">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                        <div className="absolute right-0 top-6 bg-white border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {/* ✅ FIXED: View link now uses role-based URL */}
                          <Link href={getRoleBasedProjectUrl(userRole, project._id)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Eye className="h-3 w-3 mr-2" />
                              View
                            </Button>
                          </Link>
                          {/* ✅ FIXED: Edit link now uses role-based URL */}
                          <Link href={getRoleBasedProjectUrl(userRole, project._id, 'edit')}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Edit className="h-3 w-3 mr-2" />
                              Edit
                            </Button>
                          </Link>
                          {userRole === 'super_admin' && (
                            <Button variant="ghost" size="sm" className="w-full justify-start text-red-600">
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getStatusBadgeVariant(project.status)} className="flex items-center gap-1">
                    {getStatusIcon(project.status)}
                    {project.status.replace('_', ' ')}
                  </Badge>
                  
                  <Badge variant={getPriorityBadgeVariant(project.priority)}>
                    {project.priority}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all" 
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{project.client.name}</span>
                  </div>
                  
                  {project.budget && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-green-600 font-medium">
                        {formatCurrency(project.budget)}
                      </span>
                    </div>
                  )}
                  
                  {project.endDate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Due {formatDate(project.endDate)}</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="mt-4">
                  {/* ✅ FIXED: Action button now uses role-based URL */}
                  <Link href={getRoleBasedProjectUrl(userRole, project._id)}>
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}