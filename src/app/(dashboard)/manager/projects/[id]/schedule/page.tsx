// FILE 2: src/app/(dashboard)/manager/projects/[id]/schedule/page.tsx
// ✅ CREATED: The missing project schedule page that was causing 404 errors

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

// TypeScript interfaces following established patterns
interface ProjectDetails {
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
  estimatedDuration?: string;
  actualDuration?: string;
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
  project: ProjectDetails;
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

// Helper functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': 
    case 'active': return 'bg-blue-100 text-blue-800';
    case 'pending': 
    case 'upcoming': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    case 'on_hold': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-blue-100 text-blue-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function ProjectSchedulePage() {
  const params = useParams();
  const { data: session } = useSession();
  const { toast } = useToast();

  // Extract project ID from params
  const projectId = params.id as string;

  // State management
  const [scheduleData, setScheduleData] = useState<ProjectScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'phases' | 'activities'>('phases');

  // Fetch project schedule data
  const fetchScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (!projectResponse.ok) {
        throw new Error('Project not found');
      }
      const projectData = await projectResponse.json();

      // Fetch schedule data
      const scheduleResponse = await fetch(`/api/site-schedule?projectId=${projectId}`);
      
      if (scheduleResponse.ok) {
        const scheduleResult = await scheduleResponse.json();
        
        // Combine project and schedule data
        const combinedData: ProjectScheduleData = {
          project: projectData.data,
          phases: scheduleResult.data.phases || [],
          overallStats: {
            totalActivities: scheduleResult.data.totalActivities || 0,
            completedActivities: scheduleResult.data.completedActivities || 0,
            activeActivities: 0, // Calculate from activities
            delayedActivities: 0, // Calculate from activities
            overallProgress: projectData.data.progress || 0,
            onSchedule: true, // Calculate based on timeline
            daysRemaining: undefined // Calculate based on end date
          }
        };

        // Calculate additional statistics
        if (combinedData.phases.length > 0) {
          let totalActivities = 0;
          let completedActivities = 0;
          let activeActivities = 0;
          let delayedActivities = 0;

          combinedData.phases.forEach(phase => {
            totalActivities += phase.activities.length;
            phase.activities.forEach(activity => {
              if (activity.status === 'completed') completedActivities++;
              if (activity.status === 'in_progress') activeActivities++;
              if (activity.status === 'delayed') delayedActivities++;
            });
          });

          combinedData.overallStats = {
            ...combinedData.overallStats,
            totalActivities,
            completedActivities,
            activeActivities,
            delayedActivities
          };
        }

        setScheduleData(combinedData);
      } else {
        // If no schedule data exists, create basic structure with project info
        setScheduleData({
          project: projectData.data,
          phases: [],
          overallStats: {
            totalActivities: 0,
            completedActivities: 0,
            activeActivities: 0,
            delayedActivities: 0,
            overallProgress: projectData.data.progress || 0,
            onSchedule: true,
            daysRemaining: undefined
          }
        });
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load project schedule. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  // Load data on mount
  useEffect(() => {
    if (projectId) {
      fetchScheduleData();
    }
  }, [fetchScheduleData]);

  // Filter activities based on selected filters
  const getFilteredActivities = (): ScheduleActivity[] => {
    if (!scheduleData) return [];

    let allActivities: ScheduleActivity[] = [];
    
    const phasesToInclude = selectedPhase === 'all' 
      ? scheduleData.phases 
      : scheduleData.phases.filter(p => p._id === selectedPhase);
    
    phasesToInclude.forEach(phase => {
      allActivities = [...allActivities, ...phase.activities];
    });

    if (selectedStatus !== 'all') {
      allActivities = allActivities.filter(activity => activity.status === selectedStatus);
    }

    return allActivities;
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Project not found state
  if (!scheduleData && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/manager/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
        
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Project Not Found</h3>
            <p className="text-gray-600 mb-4">
              The requested project could not be found or you don&apos;t have access to it.
            </p>
            <Link href="/manager/projects">
              <Button>Return to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredActivities = getFilteredActivities();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {scheduleData?.project.title} - Schedule
            </h1>
            <p className="text-gray-600 mt-1">
              Project timeline, phases, and activity management
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href={`/manager/projects/${projectId}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Project Details
            </Button>
          </Link>
          <Link href="/manager/site-schedule/daily">
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily Activities
            </Button>
          </Link>
          <Button className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Schedule
          </Button>
        </div>
      </div>

      {/* Project Overview */}
      {scheduleData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span className="font-medium text-gray-600">Client:</span>
                <p className="text-gray-900">{scheduleData.project.client.name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Status:</span>
                <Badge className={getStatusColor(scheduleData.project.status)}>
                  {scheduleData.project.status.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <span className="font-medium text-gray-600">Start Date:</span>
                <p className="text-gray-900">
                  {scheduleData.project.startDate ? formatDate(new Date(scheduleData.project.startDate)) : 'Not set'}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-600">End Date:</span>
                <p className="text-gray-900">
                  {scheduleData.project.endDate ? formatDate(new Date(scheduleData.project.endDate)) : 'Not set'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-600">Overall Progress</span>
                <span className="text-sm font-medium text-gray-900">{scheduleData.overallStats.overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${scheduleData.overallStats.overallProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {scheduleData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Activities</p>
                  <p className="text-3xl font-bold text-gray-900">{scheduleData.overallStats.totalActivities}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-gray-900">{scheduleData.overallStats.completedActivities}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-3xl font-bold text-gray-900">{scheduleData.overallStats.activeActivities}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delayed</p>
                  <p className="text-3xl font-bold text-gray-900">{scheduleData.overallStats.delayedActivities}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Toggle and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              Schedule View
            </CardTitle>
            
            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <Select value={viewMode} onValueChange={(value: 'phases' | 'activities') => setViewMode(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phases">By Phases</SelectItem>
                  <SelectItem value="activities">All Activities</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Phase</label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="All Phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {scheduleData?.phases.map((phase) => (
                    <SelectItem key={phase._id} value={phase._id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Content */}
      {scheduleData && (
        <>
          {viewMode === 'phases' ? (
            /* Phases View */
            <div className="space-y-6">
              {scheduleData.phases.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Created</h3>
                    <p className="text-gray-600 mb-4">
                      This project doesn&apos;t have a schedule yet. Create phases and activities to get started.
                    </p>
                    <Link href="/manager/site-schedule/daily">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Activities
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                scheduleData.phases.map((phase) => (
                  <Card key={phase._id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {phase.name}
                            <Badge className={getStatusColor(phase.status)}>
                              {phase.status.replace('_', ' ')}
                            </Badge>
                          </CardTitle>
                          {phase.description && (
                            <p className="text-sm text-gray-600 mt-1">{phase.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-600">Progress</p>
                          <p className="text-lg font-bold text-gray-900">{phase.progress}%</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <span className="font-medium text-gray-600">Start Date:</span>
                          <p className="text-gray-900">{formatDate(new Date(phase.startDate))}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">End Date:</span>
                          <p className="text-gray-900">{formatDate(new Date(phase.endDate))}</p>
                        </div>
                      </div>
                      
                      {phase.activities.length > 0 && (
                        <>
                          <h4 className="font-medium text-gray-900 mb-3">Activities ({phase.activities.length})</h4>
                          <div className="space-y-3">
                            {phase.activities.slice(0, 3).map((activity) => (
                              <div 
                                key={activity._id} 
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-gray-900">{activity.title}</h5>
                                    <Badge className={getStatusColor(activity.status)} size="sm">
                                      {activity.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span>Contractor: {activity.contractor}</span>
                                    <span>Progress: {activity.progress}%</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {phase.activities.length > 3 && (
                              <p className="text-sm text-gray-500 text-center">
                                And {phase.activities.length - 3} more activities...
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            /* Activities View */
            <Card>
              <CardHeader>
                <CardTitle>All Activities ({filteredActivities.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
                    <p className="text-gray-600 mb-4">
                      {selectedPhase !== 'all' || selectedStatus !== 'all' 
                        ? 'No activities match your current filters.'
                        : 'No activities have been scheduled for this project yet.'
                      }
                    </p>
                    <Link href="/manager/site-schedule/daily">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Activities
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredActivities.map((activity) => (
                      <div 
                        key={activity._id} 
                        className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                              <Badge className={getStatusColor(activity.status)}>
                                {activity.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={getPriorityColor(activity.priority)}>
                                {activity.priority}
                              </Badge>
                            </div>
                            
                            {activity.description && (
                              <p className="text-gray-600 mb-3">{activity.description}</p>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Contractor:</span>
                                <p>{activity.contractor}</p>
                              </div>
                              <div>
                                <span className="font-medium">Category:</span>
                                <p className="capitalize">{activity.category}</p>
                              </div>
                              <div>
                                <span className="font-medium">Start Date:</span>
                                <p>{formatDate(new Date(activity.plannedStartDate))}</p>
                              </div>
                              <div>
                                <span className="font-medium">Progress:</span>
                                <p>{activity.progress}%</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}