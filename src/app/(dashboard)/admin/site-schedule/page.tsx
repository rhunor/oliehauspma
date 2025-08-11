// src/app/(dashboard)/admin/site-schedule/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  Download,
  Upload,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle,
  XCircle,
  Loader,
  Eye,
  Edit
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";


// Mock data structure for the schedule
const mockScheduleData = {
  projectName: "Magodo Spa - Dr Seyi Adebayo",
  duration: "9 weeks",
  startDate: "2025-05-13",
  endDate: "2025-07-15",
  phases: [
    {
      id: "phase-1",
      name: "DESIGN PHASE",
      weeks: []
    },
    {
      id: "phase-2", 
      name: "CONSTRUCTION PHASE",
      weeks: [
        {
          weekNumber: 1,
          title: "DEMO & EVACUATIONS, POP MAINTENANCE",
          startDate: "2025-05-13",
          endDate: "2025-05-17",
          days: [
            {
              date: "2025-05-13",
              dayNumber: 1,
              activities: [
                {
                  id: "act-1",
                  title: "Sweeping of site",
                  contractor: "Ernest",
                  status: "completed",
                  supervisor: "Naomi",
                  comments: "This task has been completed."
                },
                {
                  id: "act-2",
                  title: "Uninstallation of sanitary wares",
                  contractor: "John",
                  status: "completed",
                  supervisor: "Naomi"
                },
                {
                  id: "act-3",
                  title: "Uninstallation of shower glass",
                  contractor: "John",
                  status: "completed",
                  supervisor: "Naomi"
                }
              ]
            },
            {
              date: "2025-05-14",
              dayNumber: 2,
              activities: [
                {
                  id: "act-4",
                  title: "Uninstallation of pry bathroom tiles",
                  contractor: "Ben",
                  status: "in_progress",
                  supervisor: "Ernest",
                  comments: "This task is currently on-going."
                }
              ]
            }
          ]
        },
        {
          weekNumber: 2,
          title: "POP MAINTENANCE, PLUMBING, ELECTRICAL & AC",
          startDate: "2025-05-19",
          endDate: "2025-05-24",
          days: []
        }
      ]
    },
    {
      id: "phase-3",
      name: "INSTALLATION PHASE",
      weeks: []
    },
    {
      id: "phase-4",
      name: "SETUP & STYLING PHASE",
      weeks: []
    }
  ]
};

export default function SiteSchedulePage() {
  
  const [scheduleData] = useState(mockScheduleData);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  // Calculate statistics
  const calculateStats = () => {
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    scheduleData.phases.forEach(phase => {
      phase.weeks.forEach(week => {
        week.days?.forEach(day => {
          day.activities?.forEach(activity => {
            total++;
            if (activity.status === 'completed') completed++;
            else if (activity.status === 'in_progress') inProgress++;
            else pending++;
          });
        });
      });
    });

    return { total, completed, inProgress, pending };
  };

  const stats = calculateStats();

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const toggleWeek = (weekId: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekId)) {
      newExpanded.delete(weekId);
    } else {
      newExpanded.add(weekId);
    }
    setExpandedWeeks(newExpanded);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Site Schedule
          </h1>
          <p className="text-neutral-600 mt-1">
            Complete project schedule with all phases and daily activities
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/admin/site-schedule/daily">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Daily Progress
            </Button>
          </Link>
        </div>
      </div>

      {/* Project Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{scheduleData.projectName}</h3>
              <p className="text-sm text-neutral-600">
                Duration: {scheduleData.duration} | 
                Start: {formatDate(scheduleData.startDate)} | 
                End: {formatDate(scheduleData.endDate)}
              </p>
            </div>
            <Link href="/admin/site-schedule/daily">
              <Button variant="outline" size="sm">
                <CalendarCheck className="h-4 w-4 mr-2" />
                Today&apos;s Activities
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600">Total Activities</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600">Pending</p>
            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search activities..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Schedule View */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6 space-y-4">
          {scheduleData.phases.map((phase) => (
            <Card key={phase.id}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => togglePhase(phase.id)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {expandedPhases.has(phase.id) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    {phase.name}
                  </CardTitle>
                  <Badge variant="outline">
                    {phase.weeks.length} weeks
                  </Badge>
                </div>
              </CardHeader>
              
              {expandedPhases.has(phase.id) && phase.weeks.length > 0 && (
                <CardContent className="space-y-4">
                  {phase.weeks.map((week) => {
                    const weekId = `${phase.id}-week-${week.weekNumber}`;
                    return (
                      <div key={weekId} className="border rounded-lg">
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleWeek(weekId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedWeeks.has(weekId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <div>
                                <p className="font-medium">
                                  Week {week.weekNumber}: {week.title}
                                </p>
                                <p className="text-sm text-neutral-600">
                                  {formatDate(week.startDate)} - {formatDate(week.endDate)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {expandedWeeks.has(weekId) && week.days && week.days.length > 0 && (
                          <div className="border-t">
                            {week.days.map((day) => (
                              <div key={day.date} className="p-4 border-b last:border-b-0">
                                <div className="mb-3">
                                  <p className="font-medium">
                                    Day {day.dayNumber} - {formatDate(day.date)}
                                  </p>
                                </div>
                                
                                <div className="space-y-2">
                                  {day.activities?.map((activity) => (
                                    <div
                                      key={activity.id}
                                      className="bg-white p-3 rounded-lg border"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            {getStatusIcon(activity.status)}
                                            <p className="font-medium">{activity.title}</p>
                                          </div>
                                          <div className="flex gap-4 text-sm text-neutral-600">
                                            <span>Contractor: {activity.contractor}</span>
                                            <span>Supervisor: {activity.supervisor}</span>
                                            <Badge className={getStatusBadgeClass(activity.status)}>
                                              {activity.status.replace('_', ' ')}
                                            </Badge>
                                          </div>
                                          {activity.comments && (
                                            <p className="text-sm text-neutral-600 mt-2">
                                              {activity.comments}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" variant="ghost">
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button size="sm" variant="ghost">
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Calendar View Coming Soon</h3>
              <p className="text-neutral-600">
                Visual calendar of all scheduled activities
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gantt" className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Gantt Chart Coming Soon</h3>
              <p className="text-neutral-600">
                Timeline visualization of project phases
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}