// src/app/(dashboard)/manager/site-schedule/page.tsx - FIXED: Fully responsive layout
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Eye,
  Edit,
  Download,
  Plus,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SiteActivity {
  _id: string;
  title: string;
  contractor: string;
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  comments?: string;
  supervisor?: string;
  projectId: string;
  projectTitle: string;
}

interface ManagerProject {
  _id: string;
  title: string;
  status: string;
  client: {
    name: string;
  };
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
    case 'delayed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

export default function ManagerSiteSchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [activities, setActivities] = useState<SiteActivity[]>([]);
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch manager's projects
      const projectsResponse = await fetch('/api/projects?manager=true');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.data.data || []);
      }

      // Fetch site schedule activities for manager's projects
      const activitiesResponse = await fetch('/api/site-schedule/activities?manager=true');
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.data || []);
      }

    } catch (error) {
      console.error('Error fetching site schedule data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load site schedule data",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter activities based on selected filters and search
  const filteredActivities = activities.filter(activity => {
    const projectMatch = selectedProject === 'all' || activity.projectId === selectedProject;
    const statusMatch = selectedStatus === 'all' || activity.status === selectedStatus;
    const searchMatch = searchQuery === '' || 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.contractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    return projectMatch && statusMatch && searchMatch;
  });

  // Calculate statistics
  const stats = {
    total: filteredActivities.length,
    completed: filteredActivities.filter(a => a.status === 'completed').length,
    inProgress: filteredActivities.filter(a => a.status === 'in_progress').length,
    delayed: filteredActivities.filter(a => a.status === 'delayed').length,
    pending: filteredActivities.filter(a => a.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 sm:h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* FIXED: Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Site Schedule</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage activities and track progress for your projects
          </p>
        </div>
        
        {/* FIXED: Responsive action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Link href="/manager/site-schedule/daily" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily View
            </Button>
          </Link>
          <Button className="flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            New Activity
          </Button>
        </div>
      </div>

      {/* FIXED: Responsive Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Delayed</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600">{stats.delayed}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow sm:col-span-1 col-span-2">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FIXED: Responsive Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter Dropdowns */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400 sm:hidden" />
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project._id} value={project._id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FIXED: Responsive Activities List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
              <p className="text-gray-600 mb-4">
                {activities.length === 0 
                  ? "No site activities have been scheduled yet."
                  : "No activities match your current filters."}
              </p>
              <Link href="/manager/site-schedule/daily">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Daily Activity
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredActivities.map((activity) => (
                <div key={activity._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* FIXED: Responsive activity content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{activity.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(activity.status)}
                          <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                            {activity.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* FIXED: Responsive activity details grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm text-gray-600">
                        <div className="truncate">
                          <span className="font-medium">Project:</span>
                          <p className="truncate" title={activity.projectTitle}>{activity.projectTitle}</p>
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Contractor:</span>
                          <p className="truncate">{activity.contractor}</p>
                        </div>
                        <div>
                          <span className="font-medium">Planned Date:</span>
                          <p>{formatDate(new Date(activity.plannedDate))}</p>
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Supervisor:</span>
                          <p className="truncate">{activity.supervisor || 'Not assigned'}</p>
                        </div>
                      </div>

                      {/* Additional details */}
                      {activity.actualDate && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-gray-600">Actual Date:</span>
                          <span className="ml-2">{formatDate(new Date(activity.actualDate))}</span>
                        </div>
                      )}

                      {activity.comments && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-600 text-sm">Comments:</span>
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">{activity.comments}</p>
                        </div>
                      )}
                    </div>

                    {/* FIXED: Responsive action buttons */}
                    <div className="flex items-center gap-2 lg:flex-col lg:gap-1 flex-shrink-0">
                      <Link href={`/manager/projects/${activity.projectId}/schedule`} className="flex-1 sm:flex-none">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Eye className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </Link>
                      <Link href={`/manager/site-schedule/activity/${activity._id}/edit`} className="flex-1 sm:flex-none">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Edit className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FIXED: Responsive Action Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
        <p className="text-sm text-gray-600 text-center sm:text-left">
          Showing {filteredActivities.length} of {activities.length} activities
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex items-center justify-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Link href="/manager/site-schedule/daily" className="w-full sm:w-auto">
            <Button className="w-full flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}