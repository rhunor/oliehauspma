"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  comments?: string;
  images?: string[];
  phase?: ActivityPhase;
  weekNumber?: number;
  projectTitle: string;
  date: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
}

const getStatusBadgeClass = (status: string): string => {
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

export default function ClientSiteSchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/site-schedule/activities?manager=false', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setActivities(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load activities' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (session) fetchActivities();
  }, [session, fetchActivities]);

  const handleSuccess = useCallback(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Group by phase → week
  const groupedByPhase: Record<ActivityPhase, Record<number, DailyActivity[]>> = {
    site_preliminaries: {},
    construction: {},
    installation: {},
    setup_styling: {},
    post_handover: {},
  };

  activities.forEach(activity => {
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

  const overallCompleted = activities.filter(a => a.status === 'completed').length;
  const overallPct = activities.length > 0 ? Math.round((overallCompleted / activities.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Site Activities</h1>
        <p className="text-gray-600 mt-1">Track your project progress by phase</p>
      </div>

      {/* Overall progress */}
      {activities.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-semibold text-gray-900">{overallPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gray-900 transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{overallCompleted} of {activities.length} activities completed</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {activities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activities Yet</h3>
            <p className="text-gray-600">There are no activities scheduled at the moment.</p>
          </CardContent>
        </Card>
      )}

      {/* Phase-grouped view */}
      {activities.length > 0 && (
        <div className="space-y-4">
          {PHASE_ORDER.map((phase) => {
            const weekMap = groupedByPhase[phase];
            const weekNums = Object.keys(weekMap).map(Number).sort((a, b) => a - b);
            const phaseActivities = activities.filter(a => (a.phase || 'construction') === phase);
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
                                        <span>{activity.contractor}</span>
                                        {activity.supervisor && <span>· {activity.supervisor}</span>}
                                      </div>
                                      {activity.description && (
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">{activity.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge className={`text-xs ${getStatusBadgeClass(activity.status)}`}>
                                        {activity.status.replace('_', ' ').replace('-', ' ')}
                                      </Badge>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
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
        userRole="client"
      />
    </div>
  );
}
