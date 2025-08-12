// src/components/projects/ProjectsList.tsx
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
  MoreVertical
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
  userRole: string;
}

export default function ProjectsList({ projects, userRole }: ProjectsListProps) {
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
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress':
          return b.progress - a.progress;
        case 'deadline':
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        default:
          return 0;
      }
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'on_hold':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'on_hold':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
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
      default:
        return 'outline';
    }
  };

  const isOverdue = (endDate: string, status: string) => {
    return new Date(endDate) < new Date() && status !== 'completed';
  };

  return (
    <div className="space-y-6">
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
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
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
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Create your first project to get started.'}
            </p>
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
                      {project.title}
                    </CardTitle>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {project.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {isOverdue(project.endDate, project.status) && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    
                    {(userRole === 'super_admin' || userRole === 'project_manager') && (
                      <div className="relative group">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                        <div className="absolute right-0 top-6 bg-white border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <Link href={`/admin/projects/${project._id}`}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Eye className="h-3 w-3 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/admin/projects/${project._id}/edit`}>
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

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Client</span>
                    <span className="font-medium">{project.client.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Manager</span>
                    <span className="font-medium">{project.manager.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Deadline</span>
                    <span className={`font-medium ${isOverdue(project.endDate, project.status) ? 'text-red-600' : ''}`}>
                      {formatDate(new Date(project.endDate))}
                    </span>
                  </div>
                  
                  {project.budget && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Budget</span>
                      <span className="font-medium">{formatCurrency(project.budget)}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {project.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{project.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Link href={`/admin/projects/${project._id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-3 w-3 mr-2" />
                      View Details
                    </Button>
                  </Link>
                  
                  <Link href={`/admin/messages?project=${project._id}`}>
                    <Button variant="ghost" size="sm">
                      <Users className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Summary */}
      <div className="text-center text-sm text-gray-500">
        Showing {filteredProjects.length} of {projects.length} projects
      </div>
    </div>
  );
}