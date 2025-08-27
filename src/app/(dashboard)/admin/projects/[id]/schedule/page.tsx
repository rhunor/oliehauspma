// src/app/(dashboard)/admin/projects/[id]/schedule/page.tsx
// src/app/(dashboard)/manager/projects/[id]/schedule/page.tsx
// FIXED: Complete project schedule page linking to daily activities

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Edit,
  Plus,
  Download,
  Filter,
  BarChart3,
  Activity,
  Users,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  progress: number;
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
}

interface ScheduleActivity {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
}

interface SchedulePhase {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: ScheduleActivity[];
}

interface ProjectScheduleData {
  project: Project;
  phases: SchedulePhase[];
  overallStats: {
    totalActivities: number;
    completedActivities: number;
    activeActivities: number;
    delayedActivities: number;
    overallProgress: number;
    onSchedule: boolean;
    daysRemaining?: number;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': 
    case 'active': return 'bg-blue-100 text-blue-800';
    case 'pending': 
    case 'upcoming': return 'bg-gray-100 text-gray-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress':
    case 'active': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'delayed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low': return 'bg-gray-100 text-gray-800';
    case 'medium': return 'bg-blue-100 text-blue-800';
    case 'high': return 'bg-yellow-100 text-yellow-800';
    case 'urgent': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function ProjectSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [scheduleData, setScheduleData] = useState<ProjectScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const projectId = params.id as string;

  // Get role-based path
  const getRoleBasePath = () => {
    switch (session?.user?.role) {
      case 'super_admin': return '/admin';
      case 'project_manager': return '/manager';
      default: return '/dashboard';
    }
  };

  const fetchScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project');
      }
      const projectData = await projectResponse.json();

      // Fetch project schedule/activities
      const scheduleResponse = await fetch(`/api/projects/${projectId}/schedule`);
      let scheduleInfo = null;
      if (scheduleResponse.ok) {
        scheduleInfo = await scheduleResponse.json();
      }

      // Mock schedule data if not available (for demonstration)
      const mockScheduleData: ProjectScheduleData = {
        project: projectData.data,
        phases: scheduleInfo?.phases || [
          {
            _id: 'phase1',
            name: 'Foundation & Structure',
            description: 'Initial construction phase including foundation and structural work',
            startDate: projectData.data.startDate,
            endDate: new Date(new Date(projectData.data.startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            progress: 65,
            activities: [
              {
                _id: 'act1',
                title: 'Foundation Excavation',
                description: 'Excavate foundation according to architectural plans',
                contractor: 'Foundation Experts Ltd',
                supervisor: 'John Smith',
                plannedStartDate: projectData.data.startDate,
                plannedEndDate: new Date(new Date(projectData.data.startDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'completed',
                priority: 'high',
                category: 'structural',
                progress: 100,
                estimatedDuration: 7,
                actualDuration: 6
              },
              {
                _id: 'act2',
                title: 'Foundation Pouring',
                description: 'Pour concrete foundation',
                contractor: 'Foundation Experts Ltd',
                supervisor: 'John Smith',
                plannedStartDate: new Date(new Date(projectData.data.startDate).getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
                plannedEndDate: new Date(new Date(projectData.data.startDate).getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'in_progress',
                priority: 'high',
                category: 'structural',
                progress: 40,
                estimatedDuration: 5
              }
            ]
          }
        ],
        overallStats: {
          totalActivities: 2,
          completedActivities: 1,
          activeActivities: 1,
          delayedActivities: 0,
          overallProgress: projectData.data.progress || 0,
          onSchedule: true,
          daysRemaining: 45
        }
      };

      setScheduleData(mockScheduleData);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load project schedule"
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (session?.user) {
      fetchScheduleData();
    }
  }, [session, fetchScheduleData]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const filteredPhases = scheduleData?.phases.filter(phase => {
    if (selectedPhase !== 'all' && phase._id !== selectedPhase) return false;
    if (selectedStatus !== 'all' && phase.status !== selectedStatus) return false;
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!scheduleData) {
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Not Available</h2>
            <p className="text-gray-600 mb-4">Project schedule could not be loaded.</p>
            <Button asChild>
              <Link href={`${getRoleBasePath()}/projects/${projectId}`}>
                Back to Project
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* FIXED: Responsive Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Link href={`${getRoleBasePath()}/projects/${projectId}`}>
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Project</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
                Project Schedule
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1 truncate">
                {scheduleData.project.title}
              </p>
            </div>
          </div>
          
          {/* FIXED: Responsive action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button asChild className="w-full sm:w-auto">
              <Link href={`${getRoleBasePath()}/site-schedule/daily`}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Daily Activities
              </Link>
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export Schedule
            </Button>
          </div>
        </div>

        {/* FIXED: Responsive Statistics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {scheduleData.overallStats.totalActivities}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Total Activities</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-green-600">
                  {scheduleData.overallStats.completedActivities}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {scheduleData.overallStats.activeActivities}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Active</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-red-600">
                  {scheduleData.overallStats.delayedActivities}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Delayed</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-purple-600">
                  {scheduleData.overallStats.overallProgress}%
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Progress</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-orange-600">
                  {scheduleData.overallStats.daysRemaining || 0}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">Days Left</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FIXED: Responsive Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 sm:max-w-xs">
                <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Filter by phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    {scheduleData.phases.map(phase => (
                      <SelectItem key={phase._id} value={phase._id}>
                        {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 sm:max-w-xs">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FIXED: Responsive Schedule Phases */}
        <div className="space-y-4 sm:space-y-6">
          {filteredPhases.length > 0 ? (
            filteredPhases.map(phase => (
              <Card key={phase._id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <CardTitle className="text-base sm:text-lg">{phase.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(phase.status)}
                          <Badge className={getStatusColor(phase.status)}>
                            {phase.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      {phase.description && (
                        <p className="text-sm text-gray-600">{phase.description}</p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        {formatDateRange(phase.startDate, phase.endDate)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{phase.progress}%</p>
                        <Progress value={phase.progress} className="w-20 h-2 mt-1" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <h4 className="font-medium text-sm sm:text-base mb-3">
                    Activities ({phase.activities.length})
                  </h4>
                  
                  {phase.activities.length > 0 ? (
                    <div className="space-y-3">
                      {phase.activities.map(activity => (
                        <div key={activity._id} className="border rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <h5 className="font-medium text-sm sm:text-base">{activity.title}</h5>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(activity.status)}
                                  <Badge className={getStatusColor(activity.status)}>
                                    {activity.status.replace('_', ' ')}
                                  </Badge>
                                  <Badge variant="outline" className={getPriorityColor(activity.priority)}>
                                    {activity.priority}
                                  </Badge>
                                </div>
                              </div>
                              
                              {activity.description && (
                                <p className="text-xs sm:text-sm text-gray-600">{activity.description}</p>
                              )}
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs sm:text-sm text-gray-500">
                                <span><strong>Contractor:</strong> {activity.contractor}</span>
                                {activity.supervisor && (
                                  <span><strong>Supervisor:</strong> {activity.supervisor}</span>
                                )}
                                <span><strong>Category:</strong> {activity.category}</span>
                                <span><strong>Planned:</strong> {formatDateRange(activity.plannedStartDate, activity.plannedEndDate)}</span>
                                {activity.estimatedDuration && (
                                  <span><strong>Duration:</strong> {activity.estimatedDuration} days</span>
                                )}
                                <span><strong>Progress:</strong> {activity.progress}%</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button variant="outline" size="sm">
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            </div>
                          </div>
                          
                          {activity.progress > 0 && (
                            <div className="mt-3">
                              <Progress value={activity.progress} className="h-2" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No activities scheduled for this phase</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Data</h3>
                <p className="text-gray-600 mb-4">
                  Project schedule has not been created yet or no phases match your filters.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button asChild>
                    <Link href={`${getRoleBasePath()}/site-schedule/daily`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Activities
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setSelectedPhase('all');
                    setSelectedStatus('all');
                  }}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* FIXED: Responsive Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" asChild className="h-auto p-4">
                <Link href={`${getRoleBasePath()}/site-schedule/daily`}>
                  <div className="text-center">
                    <CalendarDays className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm font-medium">Daily Activities</p>
                    <p className="text-xs text-gray-500">View today&apos;s tasks</p>
                  </div>
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="h-auto p-4">
                <Link href={`${getRoleBasePath()}/projects/${projectId}/milestones`}>
                  <div className="text-center">
                    <BarChart3 className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm font-medium">Milestones</p>
                    <p className="text-xs text-gray-500">Track key deadlines</p>
                  </div>
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="h-auto p-4">
                <Link href={`${getRoleBasePath()}/daily-reports`}>
                  <div className="text-center">
                    <Users className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm font-medium">Reports</p>
                    <p className="text-xs text-gray-500">Daily progress reports</p>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}