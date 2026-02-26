// FILE: src/app/(dashboard)/client/daily-reports/page.tsx - WITH COMPLETED TASKS SECTION
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle,
  TrendingUp,
  Filter,
  Search,
  ListChecks
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

// Enhanced interfaces with on_hold status
interface Activity {
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor?: string;
  startTime: string;
  endTime: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'cancelled' | 'pending' | 'on_hold';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  equipmentUsed: string[];
  crewSize: number;
  notes?: string;
  photos?: string[];
  completedAt?: string;
}

interface DailyReport {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
  activities: Activity[];
  summary: {
    totalActivities: number;
    completedActivities: number;
    inProgress: number;
    pending: number;
    delayed: number;
    onHold: number;
    weatherConditions: string;
    crewCount: number;
    equipmentUsed: string[];
    safetyIncidents: number;
    delays: string[];
    notes: string;
  };
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  _id: string;
  title: string;
  status: string;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
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

export default function ClientDailyReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // State management
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('last-7-days');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          // API returns { success, data: { projects: [...], pagination } }
          // or older shape { success, data: [...] }. Normalize both.
          const payload = data?.data;
          if (Array.isArray(payload)) {
            setProjects(payload);
          } else if (payload && Array.isArray(payload.projects)) {
            setProjects(payload.projects);
          } else {
            setProjects([]);
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, []);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        if (selectedProject && selectedProject !== 'all') {
          params.append('projectId', selectedProject);
        }
        
        if (dateFilter) {
          params.append('dateRange', dateFilter);
        }

        const response = await fetch(`/api/daily-reports?${params}`);
        if (response.ok) {
          const data = await response.json();
          // Normalize response shapes:
          // - { success, data: [reports] }
          // - { success, data: { reports: [...] } }
          // - legacy: { success, data: [...] }
          const payload = data?.data;
          if (Array.isArray(payload)) {
            setReports(payload);
          } else if (payload && Array.isArray(payload.reports)) {
            setReports(payload.reports);
          } else {
            setReports([]);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load daily reports',
          });
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'An error occurred while fetching reports',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedProject, dateFilter, toast]);

  // Filter and categorize activities
  // Defensive: ensure we always operate on an array of reports
  const safeReports: DailyReport[] = (() => {
    if (Array.isArray(reports)) return reports;
    const payload = reports as unknown;
    if (payload && typeof payload === 'object' && 'reports' in (payload as Record<string, unknown>)) {
      const maybe = (payload as Record<string, unknown>).reports;
      if (Array.isArray(maybe)) return maybe as DailyReport[];
    }
    return [];
  })();

  const allActivities = safeReports.flatMap(report => 
    (Array.isArray(report.activities) ? report.activities : []).map(activity => ({
      ...activity,
      projectTitle: report.projectTitle,
      projectId: report.projectId,
      reportDate: report.date
    }))
  );

  const completedTasks = allActivities.filter(a => a.status === 'completed');
  const inProgressTasks = allActivities.filter(a => a.status === 'in_progress');
  const pendingTasks = allActivities.filter(a => a.status === 'pending');
  const delayedTasks = allActivities.filter(a => a.status === 'delayed');
  const onHoldTasks = allActivities.filter(a => a.status === 'on_hold');

  // Filter based on search
  const filterActivities = (activities: typeof allActivities) => {
    if (!searchTerm) return activities;
    return activities.filter(activity =>
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.contractor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get activities based on active tab
  const getDisplayActivities = () => {
    switch (activeTab) {
      case 'completed':
        return filterActivities(completedTasks);
      case 'in-progress':
        return filterActivities(inProgressTasks);
      case 'pending':
        return filterActivities(pendingTasks);
      case 'delayed':
        return filterActivities(delayedTasks);
      case 'on-hold':
        return filterActivities(onHoldTasks);
      default:
        return filterActivities(allActivities);
    }
  };

  const displayActivities = getDisplayActivities();

  // Calculate statistics
  const stats = {
    total: allActivities.length,
    completed: completedTasks.length,
    inProgress: inProgressTasks.length,
    pending: pendingTasks.length,
    delayed: delayedTasks.length,
    onHold: onHoldTasks.length,
    completionRate: allActivities.length > 0 
      ? Math.round((completedTasks.length / allActivities.length) * 100)
      : 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Daily Activity Reports
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Track daily progress and completed tasks across your projects
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <ListChecks className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-600">Total Tasks</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <p className="text-xs text-gray-600">In Progress</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">{stats.delayed}</div>
              <p className="text-xs text-gray-600">Delayed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-600">{stats.onHold}</div>
              <p className="text-xs text-gray-600">On Hold</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Activity Status */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="all">
                All
                <Badge variant="secondary" className="ml-2">{stats.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                <Badge variant="secondary" className="ml-2">{stats.completed}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in-progress">
                In Progress
                <Badge variant="secondary" className="ml-2">{stats.inProgress}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                <Badge variant="secondary" className="ml-2">{stats.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="delayed">
                Delayed
                <Badge variant="secondary" className="ml-2">{stats.delayed}</Badge>
              </TabsTrigger>
              <TabsTrigger value="on-hold">
                On Hold
                <Badge variant="secondary" className="ml-2">{stats.onHold}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading activities...</p>
                </div>
              ) : displayActivities.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No activities found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayActivities.map((activity) => (
                    <Card key={activity._id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                              <Badge className={getStatusColor(activity.status)}>
                                {activity.status.replace('_', ' ')}
                              </Badge>
                              {activity.priority && (
                                <Badge variant="outline" className={getPriorityColor(activity.priority)}>
                                  {activity.priority}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mt-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(activity.reportDate)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>{activity.projectTitle}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{activity.startTime} - {activity.endTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                <span>{activity.contractor}</span>
                              </div>
                            </div>

                            {activity.description && (
                              <p className="text-sm text-gray-700 mt-3">
                                {activity.description}
                              </p>
                            )}

                            {activity.status === 'completed' && activity.completedAt && (
                              <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span>Completed on {formatDate(activity.completedAt)}</span>
                              </div>
                            )}
                          </div>

                          <Link href={`/client/projects/${activity.projectId}/schedule`}>
                            <Button variant="outline" size="sm">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}