// src/app/(dashboard)/manager/calendar/page.tsx - MANAGER CALENDAR
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  MapPin,
  Download,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: 'meeting' | 'deadline' | 'inspection' | 'delivery' | 'milestone';
  projectId?: string;
  projectTitle?: string;
  location?: string;
  attendees?: string[];
  isAllDay: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

const eventTypeColors = {
  meeting: 'bg-blue-100 text-blue-800 border-blue-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
  inspection: 'bg-purple-100 text-purple-800 border-purple-200',
  delivery: 'bg-green-100 text-green-800 border-green-200',
  milestone: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const statusColors = {
  scheduled: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ManagerCalendarPage() {
  const { data: _session } = useSession();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  // ✅ Removed unused selectedDate state
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [projects, setProjects] = useState<Array<{_id: string, title: string}>>([]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = getViewStartDate();
      const endDate = getViewEndDate();
      
      const response = await fetch(
        `/api/calendar/events?start=${startDate.toISOString()}&end=${endDate.toISOString()}&manager=true`
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load calendar events",
      });
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, toast]); // ✅ Added proper dependencies

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?manager=true&limit=100');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchProjects();
  }, [fetchEvents, fetchProjects]); // ✅ Now includes function dependencies

  const getViewStartDate = () => {
    const date = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        date.setDate(1);
        date.setDate(date.getDate() - date.getDay());
        return date;
      case 'week':
        date.setDate(date.getDate() - date.getDay());
        return date;
      case 'day':
        return date;
      default:
        return date;
    }
  };

  const getViewEndDate = () => {
    const date = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        date.setMonth(date.getMonth() + 1);
        date.setDate(0);
        date.setDate(date.getDate() + (6 - date.getDay()));
        return date;
      case 'week':
        date.setDate(date.getDate() - date.getDay() + 6);
        return date;
      case 'day':
        return date;
      default:
        return date;
    }
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    setCurrentDate(newDate);
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      
      return (eventStart <= dateEnd && eventEnd >= dateStart);
    });
  };

  const filteredEvents = events.filter(event => {
    const typeMatch = filterType === 'all' || event.type === filterType;
    const projectMatch = filterProject === 'all' || event.projectId === filterProject;
    return typeMatch && projectMatch;
  });

  const renderMonthView = () => {
    const startDate = getViewStartDate();
    const weeks = [];
    
    for (let week = 0; week < 6; week++) {
      const days = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + week * 7 + day);
        const dayEvents = getEventsForDate(date);
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isToday = date.toDateString() === new Date().toDateString();
        
        days.push(
          <div
            key={day}
            className={`min-h-[100px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
              isCurrentMonth ? 'bg-white' : 'bg-gray-50'
            } ${isToday ? 'bg-blue-50' : ''}`}
            onClick={() => {
              // ✅ Handle date selection locally without state
              console.log('Selected date:', date.toDateString());
            }}
          >
            <div className={`text-sm font-medium mb-1 ${
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
            } ${isToday ? 'text-blue-600' : ''}`}>
              {date.getDate()}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event._id}
                  className={`text-xs p-1 rounded truncate cursor-pointer ${
                    eventTypeColors[event.type]
                  }`}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      }
      weeks.push(
        <div key={week} className="grid grid-cols-7">
          {days}
        </div>
      );
    }
    
    return (
      <div className="space-y-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 border border-gray-200">
              {day}
            </div>
          ))}
        </div>
        {weeks}
      </div>
    );
  };

  const renderUpcomingEvents = () => {
    const upcoming = filteredEvents
      .filter(event => new Date(event.startDate) >= new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10);

    return (
      <div className="space-y-3">
        {upcoming.map((event) => (
          <div key={event._id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-gray-900">{event.title}</h3>
                  <Badge className={eventTypeColors[event.type]}>
                    {event.type}
                  </Badge>
                  <Badge variant="outline" className={statusColors[event.status]}>
                    {event.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                {event.description && (
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {new Date(event.startDate).toLocaleDateString()} 
                      {!event.isAllDay && ` at ${new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  
                  {event.projectTitle && (
                    <div className="flex items-center gap-1">
                      <span className="text-blue-600">{event.projectTitle}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        
        {upcoming.length === 0 && (
          <div className="text-center py-8">
            <CalendarIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No upcoming events</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">Track project schedules and important dates</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Calendar
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Calendar Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateCalendar('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigateCalendar('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <h2 className="text-xl font-semibold">
                {viewMode === 'month' && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                {viewMode === 'week' && `Week of ${currentDate.toLocaleDateString()}`}
                {viewMode === 'day' && currentDate.toLocaleDateString()}
              </h2>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>

            {/* View Mode and Filters */}
            <div className="flex items-center gap-3">
              <Select value={viewMode} onValueChange={(value: 'month' | 'week' | 'day') => setViewMode(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="deadline">Deadlines</SelectItem>
                  <SelectItem value="inspection">Inspections</SelectItem>
                  <SelectItem value="delivery">Deliveries</SelectItem>
                  <SelectItem value="milestone">Milestones</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <Card>
            <CardContent className="p-0">
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && (
                <div className="p-6">
                  <p className="text-center text-gray-500">Week view coming soon...</p>
                </div>
              )}
              {viewMode === 'day' && (
                <div className="p-6">
                  <p className="text-center text-gray-500">Day view coming soon...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {renderUpcomingEvents()}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Events</span>
                  <span className="font-semibold">{filteredEvents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Meetings</span>
                  <span className="font-semibold">
                    {filteredEvents.filter(e => e.type === 'meeting').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Deadlines</span>
                  <span className="font-semibold">
                    {filteredEvents.filter(e => e.type === 'deadline').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Inspections</span>
                  <span className="font-semibold">
                    {filteredEvents.filter(e => e.type === 'inspection').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}