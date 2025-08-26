// src/app/(dashboard)/admin/site-schedule/page.tsx - FIXED: Database-driven with responsive layout
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  CalendarCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  Plus,
  Search,
  Filter,
  XCircle,
  Loader,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

// TypeScript interfaces
interface ScheduleData {
  projectName: string;
  duration: string;
  startDate: string;
  endDate: string;
}

interface ActivityStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface Phase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  activities: Activity[];
}

interface Activity {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  assignee: string;
  dueDate: string;
  progress: number;
}

export default function AdminSiteSchedulePage() {
  const { toast } = useToast();
  
  // State management - now properly fetching from DB
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0
  });
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch schedule data from database
  const fetchScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch main schedule/project data
      const scheduleResponse = await fetch('/api/site-schedule');
      if (scheduleResponse.ok) {
        const scheduleResult = await scheduleResponse.json();
        if (scheduleResult.success && scheduleResult.data) {
          setScheduleData(scheduleResult.data);
        }
      }

      // Fetch phases and activities
      const phasesResponse = await fetch('/api/site-schedule/phases');
      if (phasesResponse.ok) {
        const phasesResult = await phasesResponse.json();
        if (phasesResult.success && phasesResult.data) {
          setPhases(phasesResult.data);
        }
      }

      // Fetch activity statistics
      const statsResponse = await fetch('/api/site-schedule/stats');
      if (statsResponse.ok) {
        const statsResult = await statsResponse.json();
        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data);
        }
      }

    } catch (error) {
      console.error('Error fetching schedule data:', error);
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
    fetchScheduleData();
  }, [fetchScheduleData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Loader className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  // Filter phases and activities based on search and status
  const filteredPhases = phases.filter(phase => {
    const phaseMatch = searchQuery === '' || 
      phase.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const statusMatch = statusFilter === 'all' || 
      phase.activities.some(activity => 
        statusFilter === 'all' || activity.status === statusFilter
      );
    
    return phaseMatch && statusMatch;
  });

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
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            Site Schedule
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 mt-1">
            Complete project schedule with all phases and daily activities
          </p>
        </div>
        
        {/* FIXED: Responsive Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
          <Link href="/admin/site-schedule/daily" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Daily Progress
            </Button>
          </Link>
        </div>
      </div>

      {/* FIXED: Responsive Project Info Card - Only show if data exists */}
      {scheduleData && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg mb-2">{scheduleData.projectName}</h3>
                
                {/* FIXED: Responsive project details */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-neutral-600">
                  {scheduleData.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span>Duration: {scheduleData.duration}</span>
                    </div>
                  )}
                  {scheduleData.startDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>Start: {formatDate(scheduleData.startDate)}</span>
                    </div>
                  )}
                  {scheduleData.endDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>End: {formatDate(scheduleData.endDate)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* FIXED: Responsive Today's Activities Button */}
              <div className="flex-shrink-0 w-full sm:w-auto">
                <Link href="/admin/site-schedule/daily" className="block">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <CalendarCheck className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Today&apos;s Activities</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FIXED: Responsive Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-600">Total Activities</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-600">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* FIXED: Responsive Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400 sm:hidden" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
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
              
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                <span className="sm:hidden">More Filters</span>
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FIXED: Responsive Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none sm:flex">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
            <TabsTrigger value="gantt" className="text-xs sm:text-sm">Gantt Chart</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 sm:mt-6">
          {filteredPhases.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Data</h3>
                <p className="text-gray-600 mb-4">
                  {phases.length === 0 
                    ? "No project phases have been created yet."
                    : "No phases match your current search criteria."}
                </p>
                <Link href="/admin/site-schedule/daily">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Daily Activities
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            filteredPhases.map((phase) => (
              <Card key={phase.id} className="mb-4">
                <CardContent className="p-0">
                  {/* FIXED: Responsive Phase Header */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => togglePhase(phase.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {expandedPhases.has(phase.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{phase.name}</h3>
                        
                        {/* FIXED: Responsive phase details */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 mt-1">
                          {phase.startDate && phase.endDate && (
                            <>
                              <span>{formatDate(phase.startDate)} - {formatDate(phase.endDate)}</span>
                              <span className="hidden sm:inline">•</span>
                            </>
                          )}
                          <span>{phase.activities.length} activities</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* FIXED: Responsive progress section */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium">{phase.progress}%</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${phase.progress}%` }}
                          />
                        </div>
                      </div>
                      <Badge className="text-xs">{phase.progress}%</Badge>
                    </div>
                  </div>

                  {/* FIXED: Responsive Activities List */}
                  {expandedPhases.has(phase.id) && (
                    <div className="border-t bg-gray-50">
                      <div className="p-4">
                        {phase.activities.length === 0 ? (
                          <div className="text-center py-8">
                            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No activities in this phase</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {phase.activities.map((activity) => (
                              <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-lg border gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {getStatusIcon(activity.status)}
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-sm sm:text-base">{activity.name}</h4>
                                    
                                    {/* FIXED: Responsive activity details */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-600 mt-1">
                                      {activity.dueDate && (
                                        <>
                                          <span>Due: {formatDate(activity.dueDate)}</span>
                                          <span className="hidden sm:inline">•</span>
                                        </>
                                      )}
                                      {activity.assignee && (
                                        <span>Assigned: {activity.assignee}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between sm:justify-end gap-2">
                                  <Badge className={`text-xs ${getStatusBadgeClass(activity.status)}`}>
                                    {activity.status.replace('_', ' ')}
                                  </Badge>
                                  
                                  {/* FIXED: Responsive action buttons */}
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardContent className="p-6 sm:p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Calendar View Coming Soon</h3>
              <p className="text-sm sm:text-base text-neutral-600">
                Visual calendar of all scheduled activities
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gantt" className="mt-6">
          <Card>
            <CardContent className="p-6 sm:p-8 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Gantt Chart Coming Soon</h3>
              <p className="text-sm sm:text-base text-neutral-600">
                Timeline visualization of project phases
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}