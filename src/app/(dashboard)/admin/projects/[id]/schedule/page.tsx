// src/app/(dashboard)/admin/projects/[id]/schedule/page.tsx - FUNCTIONAL VERSION
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
  Plus,
  RefreshCcw,
  Loader2,
  Filter,
  Download,
  BarChart3,
  Activity,
  Users,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Types
interface Project {
  _id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  status: string;
  progress: number;
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
  resources?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

interface OverallStats {
  totalActivities: number;
  completedActivities: number;
  activeActivities: number;
  delayedActivities: number;
  overallProgress: number;
  onSchedule: boolean;
  daysRemaining?: number;
}

interface ScheduleData {
  project: Project;
  phases: SchedulePhase[];
  overallStats: OverallStats;
  upcomingActivities: ScheduleActivity[];
}

interface CreatePhaseForm {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  dependencies: string[];
}

export default function ProjectSchedulePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const projectId = params?.id as string;
  const userRole = session?.user?.role;
  
  // State management
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<CreatePhaseForm>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    dependencies: []
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch schedule data
  const fetchScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/schedule`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setScheduleData(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch schedule');
        }
      } else {
        throw new Error(`HTTP ${response.status}: Failed to fetch schedule`);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load schedule",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (projectId && session?.user) {
      fetchScheduleData();
    }
  }, [projectId, session, fetchScheduleData]);

  // Handle form input changes
  const handleFormChange = (field: keyof CreatePhaseForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate create form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'Phase name is required';
    if (!formData.startDate) errors.startDate = 'Start date is required';
    if (!formData.endDate) errors.endDate = 'End date is required';
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        errors.endDate = 'End date must be after start date';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle phase creation
  const handleCreatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors before creating the phase",
      });
      return;
    }

    try {
      setCreating(true);
      
      const response = await fetch(`/api/projects/${projectId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
          dependencies: formData.dependencies
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Phase created successfully",
        });
        
        // Reset form and close dialog
        setFormData({
          name: '',
          description: '',
          startDate: '',
          endDate: '',
          dependencies: []
        });
        setCreateDialogOpen(false);
        
        // Refresh schedule
        fetchScheduleData();
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create phase');
      }
    } catch (error) {
      console.error('Error creating phase:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create phase",
      });
    } finally {
      setCreating(false);
    }
  };

  // Toggle phase expansion - REMOVED (now using controlled state directly)

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100', label: 'Completed' };
      case 'active':
      case 'in_progress':
        return { icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Active' };
      case 'delayed':
        return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-100', label: 'Delayed' };
      default:
        return { icon: Clock, color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Upcoming' };
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: ScheduleActivity['priority']) => {
    const variants = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    
    return (
      <Badge className={variants[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  // Get category badge
  const getCategoryBadge = (category: ScheduleActivity['category']) => {
    const variants = {
      structural: 'bg-stone-100 text-stone-700',
      electrical: 'bg-yellow-100 text-yellow-700',
      plumbing: 'bg-blue-100 text-blue-700',
      finishing: 'bg-green-100 text-green-700',
      other: 'bg-gray-100 text-gray-700'
    };
    
    return (
      <Badge variant="outline" className={variants[category]}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter activities across all phases
  const getFilteredActivities = () => {
    if (!scheduleData) return [];
    
    const allActivities = scheduleData.phases.flatMap(phase => 
      phase.activities.map(activity => ({ ...activity, phaseName: phase.name }))
    );
    
    return allActivities.filter(activity => {
      const statusMatch = statusFilter === 'all' || activity.status === statusFilter;
      const categoryMatch = categoryFilter === 'all' || activity.category === categoryFilter;
      return statusMatch && categoryMatch;
    });
  };

  const canCreatePhases = ['super_admin', 'project_manager'].includes(userRole || '');
  const backUrl = userRole === 'project_manager' ? `/manager/projects/${projectId}` : `/admin/projects/${projectId}`;

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={backUrl}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Schedule</h1>
            <p className="text-gray-600">{scheduleData?.project?.title}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={fetchScheduleData} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {canCreatePhases && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Phase
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleCreatePhase}>
                  <DialogHeader>
                    <DialogTitle>Create New Phase</DialogTitle>
                    <DialogDescription>
                      Add a new phase to organize project activities
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Phase Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        className={formErrors.name ? 'border-red-500' : ''}
                        placeholder="Enter phase name"
                      />
                      {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        placeholder="Describe the phase objectives and scope"
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleFormChange('startDate', e.target.value)}
                          className={formErrors.startDate ? 'border-red-500' : ''}
                        />
                        {formErrors.startDate && <p className="text-sm text-red-500">{formErrors.startDate}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => handleFormChange('endDate', e.target.value)}
                          className={formErrors.endDate ? 'border-red-500' : ''}
                        />
                        {formErrors.endDate && <p className="text-sm text-red-500">{formErrors.endDate}</p>}
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Phase'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Statistics */}
      {scheduleData?.overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{scheduleData.overallStats.totalActivities}</div>
              <div className="text-sm text-gray-600">Total Activities</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{scheduleData.overallStats.completedActivities}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{scheduleData.overallStats.activeActivities}</div>
              <div className="text-sm text-gray-600">Active</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{scheduleData.overallStats.delayedActivities}</div>
              <div className="text-sm text-gray-600">Delayed</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{scheduleData.overallStats.overallProgress}%</div>
              <div className="text-sm text-gray-600">Progress</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${scheduleData.overallStats.onSchedule ? 'text-green-600' : 'text-red-600'}`}>
                {scheduleData.overallStats.onSchedule ? 'ON' : 'OFF'}
              </div>
              <div className="text-sm text-gray-600">Schedule</div>
            </CardContent>
          </Card>
          
          {scheduleData.overallStats.daysRemaining !== undefined && (
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{scheduleData.overallStats.daysRemaining}</div>
                <div className="text-sm text-gray-600">Days Left</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-700">Filters:</span>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="structural">Structural</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            <SelectItem value="plumbing">Plumbing</SelectItem>
            <SelectItem value="finishing">Finishing</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project Schedule Phases */}
      <div className="space-y-4">
        {!scheduleData?.phases || scheduleData.phases.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Schedule Phases</h3>
              <p className="text-gray-600 mb-4">
                This project doesn&apos;t have any schedule phases yet.
              </p>
              {canCreatePhases && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Phase
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          scheduleData.phases.map((phase) => {
            const statusInfo = getStatusInfo(phase.status);
            const StatusIcon = statusInfo.icon;
            const isExpanded = expandedPhases.has(phase._id);
            
            return (
              <Card key={phase._id} className="overflow-hidden">
                <Collapsible 
                  open={isExpanded} 
                  onOpenChange={(open) => {
                    const newExpanded = new Set(expandedPhases);
                    if (open) {
                      newExpanded.add(phase._id);
                    } else {
                      newExpanded.delete(phase._id);
                    }
                    setExpandedPhases(newExpanded);
                  }}
                >
                  <div className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-4 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                            <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                          </div>
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">{phase.name}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className={statusInfo.color}>{statusInfo.label}</span>
                            <span>•</span>
                            <span>{formatDate(phase.startDate)} - {formatDate(phase.endDate)}</span>
                            <span>•</span>
                            <span>{phase.activities.length} activities</span>
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{phase.progress}% Complete</div>
                        <Progress value={phase.progress} className="w-24 h-2 mt-1" />
                      </div>
                      
                      {canCreatePhases && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Phase
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Activity
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Phase
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  
                  {phase.description && (
                    <div className="px-6 pb-2">
                      <p className="text-sm text-gray-600 ml-10">{phase.description}</p>
                    </div>
                  )}
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="ml-10 space-y-3">
                        {phase.activities.length === 0 ? (
                          <div className="text-center py-8">
                            <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">No activities in this phase</p>
                            {canCreatePhases && (
                              <Button variant="outline" size="sm" className="mt-2">
                                <Plus className="h-3 w-3 mr-1" />
                                Add Activity
                              </Button>
                            )}
                          </div>
                        ) : (
                          phase.activities.map((activity) => {
                            const activityStatusInfo = getStatusInfo(activity.status);
                            const ActivityStatusIcon = activityStatusInfo.icon;
                            
                            return (
                              <div key={activity._id} className="border rounded-lg p-4 bg-white">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className={`p-1.5 rounded ${activityStatusInfo.bgColor}`}>
                                        <ActivityStatusIcon className={`h-3 w-3 ${activityStatusInfo.color}`} />
                                      </div>
                                      <div>
                                        <h4 className="font-medium text-gray-900">{activity.title}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                          <span>{activity.contractor}</span>
                                          {activity.supervisor && (
                                            <>
                                              <span>•</span>
                                              <span>Supervised by {activity.supervisor}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {activity.description && (
                                      <p className="text-sm text-gray-600 mb-3 ml-8">{activity.description}</p>
                                    )}
                                    
                                    <div className="flex items-center gap-4 ml-8 flex-wrap">
                                      {getPriorityBadge(activity.priority)}
                                      {getCategoryBadge(activity.category)}
                                      
                                      <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(activity.plannedStartDate)} - {formatDate(activity.plannedEndDate)}</span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">Progress:</span>
                                        <Progress value={activity.progress} className="w-16 h-1" />
                                        <span className="text-xs text-gray-600">{activity.progress}%</span>
                                      </div>
                                    </div>
                                    
                                    {activity.notes && (
                                      <div className="mt-2 ml-8">
                                        <p className="text-xs text-gray-500 italic">{activity.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {canCreatePhases && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <MoreVertical className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem>
                                          <Edit className="h-3 w-3 mr-2" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600">
                                          <Trash2 className="h-3 w-3 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      {/* Upcoming Activities Sidebar */}
      {scheduleData?.upcomingActivities && scheduleData.upcomingActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Activities (Next 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduleData.upcomingActivities.slice(0, 5).map((activity) => {
                const statusInfo = getStatusInfo(activity.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={activity._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`p-1 rounded ${statusInfo.bgColor}`}>
                      <StatusIcon className={`h-3 w-3 ${statusInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                      <p className="text-xs text-gray-600">{formatDate(activity.plannedStartDate)}</p>
                    </div>
                    <div className="text-right">
                      {getPriorityBadge(activity.priority)}
                    </div>
                  </div>
                );
              })}
              
              {scheduleData.upcomingActivities.length > 5 && (
                <div className="text-center pt-2">
                  <Button variant="ghost" size="sm">
                    View all {scheduleData.upcomingActivities.length} upcoming activities
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}