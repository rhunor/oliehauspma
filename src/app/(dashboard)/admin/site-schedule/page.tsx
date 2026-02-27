'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ActivityModal from '@/components/ActivityModal';
import { ActivityPhase, PHASE_LABELS, PHASE_ORDER } from '@/types/activity';

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
  phase?: ActivityPhase;
  weekNumber?: number;
  projectId: string;
  projectTitle: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-gray-100 text-gray-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800';
    case 'to-do': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
    case 'delayed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'to-do': return <Calendar className="h-4 w-4 text-purple-500" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const PHASE_BG: Record<ActivityPhase, string> = {
  site_preliminaries: 'bg-blue-50 border-blue-200',
  construction: 'bg-orange-50 border-orange-200',
  installation: 'bg-purple-50 border-purple-200',
  setup_styling: 'bg-emerald-50 border-emerald-200',
  post_handover: 'bg-rose-50 border-rose-200',
};

const PHASE_BADGE: Record<ActivityPhase, string> = {
  site_preliminaries: 'bg-blue-100 text-blue-800',
  construction: 'bg-orange-100 text-orange-800',
  installation: 'bg-purple-100 text-purple-800',
  setup_styling: 'bg-emerald-100 text-emerald-800',
  post_handover: 'bg-rose-100 text-rose-800',
};

const PHASE_PROGRESS_BAR: Record<ActivityPhase, string> = {
  site_preliminaries: 'bg-blue-500',
  construction: 'bg-orange-500',
  installation: 'bg-purple-500',
  setup_styling: 'bg-emerald-500',
  post_handover: 'bg-rose-500',
};

export default function AdminSiteSchedulePage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'phase' | 'flat'>('phase');
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/site-schedule/activities?role=admin', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load activities' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filteredActivities = activities.filter(activity => {
    const statusMatch = selectedStatus === 'all' || activity.status === selectedStatus;
    const searchMatch = searchQuery === '' ||
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.contractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  const stats = {
    total: filteredActivities.length,
    completed: filteredActivities.filter(a => a.status === 'completed').length,
    inProgress: filteredActivities.filter(a => a.status === 'in_progress').length,
    delayed: filteredActivities.filter(a => a.status === 'delayed').length,
  };

  // Group by phase → week
  const groupedByPhase: Record<ActivityPhase, Record<number, DailyActivity[]>> = {
    site_preliminaries: {},
    construction: {},
    installation: {},
    setup_styling: {},
    post_handover: {},
  };

  filteredActivities.forEach(activity => {
    const phase: ActivityPhase = activity.phase || 'construction';
    const week = activity.weekNumber || 1;
    if (!groupedByPhase[phase][week]) groupedByPhase[phase][week] = [];
    groupedByPhase[phase][week].push(activity);
  });

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  };

  const toggleWeek = (key: string) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleActivityClick = (activity: DailyActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleSuccess = useCallback(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Site Schedule</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track progress across construction phases</p>
        </div>
        <Link href="/admin/site-schedule/daily" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            <Calendar className="h-4 w-4 mr-2" />
            Daily View
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Total</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Delayed</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.delayed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + View Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search activities, contractors, projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
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
                  <SelectItem value="to-do">To-Do</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border overflow-hidden shrink-0">
                <button
                  onClick={() => setViewMode('phase')}
                  className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${
                    viewMode === 'phase' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Phase view"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Phase</span>
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors border-l ${
                    viewMode === 'flat' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="List view"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {filteredActivities.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
            <p className="text-gray-600 mb-4">No site activities match your current filters.</p>
            <Link href="/admin/site-schedule/daily">
              <Button><Plus className="h-4 w-4 mr-2" /> Add Daily Activity</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Flat list view */}
      {filteredActivities.length > 0 && viewMode === 'flat' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>All Activities ({filteredActivities.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {filteredActivities.map((activity) => (
                <div
                  key={activity._id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(activity.status)}
                        <span className="font-medium text-gray-900 truncate">{activity.title}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                        <span>{activity.projectTitle}</span>
                        <span>· {activity.contractor}</span>
                        {activity.phase && (
                          <Badge className={`text-xs ${PHASE_BADGE[activity.phase]}`}>
                            {PHASE_LABELS[activity.phase]}
                            {activity.weekNumber ? ` · Wk ${activity.weekNumber}` : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                        {activity.status.replace('_', ' ')}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase-grouped view */}
      {filteredActivities.length > 0 && viewMode === 'phase' && (
        <div className="space-y-4">
          {PHASE_ORDER.map((phase) => {
            const weekMap = groupedByPhase[phase];
            const weekNums = Object.keys(weekMap).map(Number).sort((a, b) => a - b);
            const phaseActivities = filteredActivities.filter(a => (a.phase || 'construction') === phase);
            const phaseCompleted = phaseActivities.filter(a => a.status === 'completed').length;
            const phaseTotal = phaseActivities.length;
            const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

            if (phaseTotal === 0) return null;

            const isPhaseCollapsed = collapsedPhases.has(phase);

            return (
              <div key={phase} className={`rounded-xl border-2 overflow-hidden ${PHASE_BG[phase]}`}>
                {/* Phase header */}
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => togglePhase(phase)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                    <Badge className={`text-xs font-medium shrink-0 ${PHASE_BADGE[phase]}`}>
                      {PHASE_LABELS[phase]}
                    </Badge>
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-600">{phaseCompleted}/{phaseTotal} completed</span>
                        <span className="text-xs font-semibold text-gray-800">{phasePct}%</span>
                      </div>
                      <div className="w-full max-w-xs bg-white/60 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${PHASE_PROGRESS_BAR[phase]}`}
                          style={{ width: `${phasePct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 sm:hidden">{phaseCompleted}/{phaseTotal}</span>
                  </div>
                  {isPhaseCollapsed
                    ? <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                    : <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
                  }
                </button>

                {!isPhaseCollapsed && (
                  <div className="px-4 pb-4 space-y-3">
                    {weekNums.map((week) => {
                      const weekKey = `${phase}-week-${week}`;
                      const weekActivities = weekMap[week];
                      const weekDone = weekActivities.filter(a => a.status === 'completed').length;
                      const isWeekCollapsed = collapsedWeeks.has(weekKey);

                      return (
                        <div key={weekKey} className="bg-white rounded-lg border overflow-hidden shadow-sm">
                          {/* Week header */}
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            onClick={() => toggleWeek(weekKey)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-gray-800">Week {week}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {weekDone}/{weekActivities.length} done
                              </span>
                            </div>
                            {isWeekCollapsed
                              ? <ChevronDown className="h-4 w-4 text-gray-400" />
                              : <ChevronUp className="h-4 w-4 text-gray-400" />
                            }
                          </button>

                          {!isWeekCollapsed && (
                            <div className="divide-y divide-gray-100">
                              {weekActivities.map((activity) => (
                                <div
                                  key={activity._id}
                                  className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                                  onClick={() => handleActivityClick(activity)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        {getStatusIcon(activity.status)}
                                        <span className="font-medium text-gray-900 text-sm">{activity.title}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                        <span>{activity.projectTitle}</span>
                                        <span>· {activity.contractor}</span>
                                        {activity.supervisor && <span>· {activity.supervisor}</span>}
                                      </div>
                                    </div>
                                    <Badge className={`text-xs shrink-0 ${getStatusColor(activity.status)}`}>
                                      {activity.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActivityModal
        activity={selectedActivity}
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        projectId={selectedActivity?.projectId || ''}
        date={selectedActivity?.date || ''}
        onSuccess={handleSuccess}
        userRole="admin"
      />
    </div>
  );
}
