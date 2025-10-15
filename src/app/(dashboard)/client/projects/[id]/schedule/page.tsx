// src/app/(dashboard)/client/projects/[id]/schedule/page.tsx
// Client project schedule page with ActivityDetailModal integration
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ActivityModal from '@/components/ActivityModal';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronDown,
  ChevronRight,
  Search,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react';
import type { Activity, Phase } from '@/types/activity';

interface DailyActivity {
  _id: string;
  title: string;
  description?: string;
  contractor: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  comments?: string;
  images?: string[];
  progress?: number;
  projectId?: string;
  projectTitle?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectData {
  _id: string;
  title: string;
  status: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  manager?: {
    name: string;
    email: string;
  };
}

export default function ClientProjectSchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const params = useParams<{ id: string }>();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);


  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${params.id}`);
      if (projectResponse.ok) {
        const projectResult = await projectResponse.json();
        if (projectResult.success && projectResult.data) {
          setProject(projectResult.data);
          
          // Extract phases from project
          if (projectResult.data.siteSchedule && projectResult.data.siteSchedule.phases) {
            setPhases(projectResult.data.siteSchedule.phases);
            // Expand all phases by default for client view
            const allPhaseIds = projectResult.data.siteSchedule.phases.map((p: Phase) => p._id);
            setExpandedPhases(new Set(allPhaseIds));
          }
        }
      } else {
        throw new Error('Failed to fetch project');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load project schedule',
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    if (params.id) {
      fetchSchedule();
    }
  }, [params.id, fetchSchedule]);

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

 const handleActivityClick = async (activityId: string) => {
  try {
    const response = await fetch(`/api/site-schedule/activity/${activityId}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setSelectedActivity(data.data);
      setIsModalOpen(true);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load activity' });
    }
  } catch (error) {
    console.error('Error fetching activity:', error);
    toast({ variant: 'destructive', title: 'Error', description: 'Failed to load activity' });
  }
};

const handleSuccess = useCallback(() => {
  fetchSchedule(); // Refetch phases/project after update
}, [fetchSchedule]);

  const handleActivityUpdated = (updatedActivity: Activity) => {
    // Update the activity in the local state (for comment updates)
    setPhases(prevPhases =>
      prevPhases.map(phase => ({
        ...phase,
        activities: phase.activities.map(activity =>
          activity._id === updatedActivity._id ? updatedActivity : activity
        ),
      }))
    );
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'to-do':
        return 'bg-gray-100 text-gray-800';
      case 'delayed':
        return 'bg-red-100 text-red-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'to-do':
        return <Calendar className="h-5 w-5 text-gray-400" />;
      case 'delayed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'on_hold':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate statistics
  const stats = {
    totalActivities: phases.reduce((sum, phase) => sum + phase.activities.length, 0),
    completedActivities: phases.reduce(
      (sum, phase) => sum + phase.activities.filter(a => a.status === 'completed').length,
      0
    ),
    inProgressActivities: phases.reduce(
      (sum, phase) => sum + phase.activities.filter(a => a.status === 'in_progress').length,
      0
    ),
    pendingActivities: phases.reduce(
      (sum, phase) => sum + phase.activities.filter(a => a.status === 'to-do').length,
      0
    ),
  };

  // Filter phases and activities
  const filteredPhases = phases.filter(phase => {
    const phaseMatch =
      searchQuery === '' ||
      phase.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phase.activities.some(activity =>
        activity.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const hasMatchingStatus =
      statusFilter === 'all' ||
      phase.activities.some(activity => activity.status === statusFilter);

    return phaseMatch && hasMatchingStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/client/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Projects
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{project?.title || 'Project Schedule'}</h1>
          <p className="text-gray-600 mt-1">
            View project progress and deliverables
          </p>
        </div>
      </div>

      {/* Project Overview */}
      {project && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Project Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge variant="outline" className="capitalize">
                      {project.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Overall Progress:</span>
                    <span className="font-semibold">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Deliverables Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.completedActivities}</p>
                    <p className="text-xs text-gray-600">Completed</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.inProgressActivities}</p>
                    <p className="text-xs text-gray-600">In Progress</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600">{stats.pendingActivities}</p>
                    <p className="text-xs text-gray-600">Pending</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{stats.totalActivities}</p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="to-do">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900">
                <strong>Click on any deliverable</strong> to view details, add comments, and upload images. 
                Your project manager will see your updates in real-time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phases List */}
      {filteredPhases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              {phases.length === 0
                ? 'No deliverables found for this project yet.'
                : 'No deliverables match your search criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPhases.map((phase) => (
            <Card key={phase._id} className="border-2">
              <CardHeader className="bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePhase(phase._id)}
                    >
                      {expandedPhases.has(phase._id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{phase.name}</CardTitle>
                      {phase.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {phase.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-sm">
                      {phase.activities.length} Deliverables
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all"
                          style={{ width: `${phase.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 min-w-[3rem]">
                        {phase.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedPhases.has(phase._id) && (
                <CardContent className="pt-4">
                  {phase.activities.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">
                      No deliverables in this phase yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {phase.activities
                        .filter(activity => 
                          statusFilter === 'all' || activity.status === statusFilter
                        )
                        .map((activity) => (
                          <div
                            key={activity._id}
                            className="border-2 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                            onClick={() => handleActivityClick(activity._id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  {getStatusIcon(activity.status)}
                                  <h4 className="font-semibold text-lg">
                                    {activity.title}
                                  </h4>
                                  <Badge className={getStatusColor(activity.status)}>
                                    {activity.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                {activity.description && (
                                  <p className="text-sm text-gray-700 mb-3 ml-8">
                                    {activity.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 ml-8">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                                  </span>
                                  {activity.comments.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-4 w-4" />
                                      {activity.comments.length} comment{activity.comments.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {activity.images && activity.images.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <ImageIcon className="h-4 w-4" />
                                      {activity.images.length} image{activity.images.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {activity.contractor && (
                                    <span>Contractor: {activity.contractor}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 ml-8">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-3">
                                  <div
                                    className="bg-blue-600 h-3 rounded-full transition-all"
                                    style={{ width: `${activity.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 min-w-[3rem]">
                                  {activity.progress}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Activity Detail Modal */}
      {(
        <ActivityModal
  activity={selectedActivity}
  isOpen={isModalOpen}
  onClose={() => { setIsModalOpen(false); setSelectedActivity(null); }}
  projectId={params.id}
  date={selectedActivity?.date || new Date().toISOString().split('T')[0]} // Fallback to today
  onSuccess={handleSuccess}
  userRole="client" // Or "manager"/"client" per file
/>
      )}
    </div>
  );
}