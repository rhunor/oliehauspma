// src/app/(dashboard)/admin/projects/[id]/schedule/page.tsx
// Admin project schedule page with ActivityDetailModal integration
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
  Plus,
  Search,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
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
}

export default function AdminProjectSchedulePage() {
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
    // Update the activity in the local state
    setPhases(prevPhases =>
      prevPhases.map(phase => ({
        ...phase,
        activities: phase.activities.map(activity =>
          activity._id === updatedActivity._id ? updatedActivity : activity
        ),
      }))
    );
    
    // Refresh to get updated progress
    fetchSchedule();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{project?.title || 'Project Schedule'}</h1>
            <p className="text-gray-600 mt-1">
              View and manage project phases and activities
            </p>
          </div>
        </div>
      </div>

      {/* Project Stats */}
      {project && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-2xl font-bold capitalize">{project.status}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Progress</p>
                  <p className="text-2xl font-bold">{project.progress}%</p>
                </div>
                <AlertCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Phases</p>
                  <p className="text-2xl font-bold">{phases.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Activities</p>
                  <p className="text-2xl font-bold">
                    {phases.reduce((sum, phase) => sum + phase.activities.length, 0)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search activities..."
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

      {/* Phases List */}
      {filteredPhases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              {phases.length === 0
                ? 'No schedule phases found for this project.'
                : 'No phases match your search criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPhases.map((phase) => (
            <Card key={phase._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePhase(phase._id)}
                    >
                      {expandedPhases.has(phase._id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <CardTitle>{phase.name}</CardTitle>
                      {phase.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {phase.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {phase.activities.length} Activities
                    </Badge>
                    <div className="text-sm text-gray-600">
                      {phase.progress}% Complete
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedPhases.has(phase._id) && (
                <CardContent>
                  {phase.activities.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">
                      No activities in this phase yet.
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
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleActivityClick(activity._id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">
                                    {activity.title}
                                  </h4>
                                  <Badge className={getStatusColor(activity.status)}>
                                    {activity.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                {activity.description && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    {activity.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {activity.contractor && (
                                    <span>Contractor: {activity.contractor}</span>
                                  )}
                                  <span>Progress: {activity.progress}%</span>
                                  {activity.comments.length > 0 && (
                                    <span>{activity.comments.length} comments</span>
                                  )}
                                  <span>
                                    {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${activity.progress}%` }}
                                ></div>
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
      { (
     <ActivityModal
  activity={selectedActivity}
  isOpen={isModalOpen}
  onClose={() => { setIsModalOpen(false); setSelectedActivity(null); }}
  projectId={params.id}
  date={selectedActivity?.date || new Date().toISOString().split('T')[0]} // Fallback to today
  onSuccess={handleSuccess}
  userRole="admin" // Or "manager"/"client" per file
/>
      )}
    </div>
  );
}