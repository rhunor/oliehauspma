// src/app/(dashboard)/client/calendar/page.tsx - CLIENT CALENDAR
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
  Users,
  MessageSquare,
  Bell,
  Eye,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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
  isClientVisible: boolean;
}

const eventTypeColors = {
  meeting: 'bg-blue-100 text-blue-800 border-blue-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
  inspection: 'bg-purple-100 text-purple-800 border-purple-200',
  delivery: 'bg-green-100 text-green-800 border-green-200',
  milestone: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const eventTypeLabels = {
  meeting: 'Meeting',
  deadline: 'Deadline',
  inspection: 'Site Visit',
  delivery: 'Delivery',
  milestone: 'Milestone',
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ClientCalendarPage() {
  const { data: _session } = useSession(); // Prefixed with underscore - not used but may be needed for auth
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  // Removed unused 'projects' state variable

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = getMonthStartDate();
      const endDate = getMonthEndDate();
      
      const response = await fetch(
        `/api/calendar/events?start=${startDate.toISOString()}&end=${endDate.toISOString()}&client=true`
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
  }, [currentDate, toast]); // Added proper dependencies

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?client=true&limit=100');
      if (response.ok) {
        const data = await response.json();
        // Projects data fetched but not stored since it's not used in this component
        console.log('Projects available:', data.data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchProjects();
  }, [fetchEvents, fetchProjects]); // Now includes both function dependencies

  const getMonthStartDate = () => {
    const date = new Date(currentDate);
    date.setDate(1);
    date.setDate(date.getDate() - date.getDay());
    return date;
  };

  const getMonthEndDate = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    date.setDate(date.getDate() + (6 - date.getDay()));
    return date;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
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
    return typeMatch && event.isClientVisible;
  });

  const upcomingEvents = filteredEvents
    .filter(event => new Date(event.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const renderMonthView = () => {
    const startDate = getMonthStartDate();
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
            } ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}
            onClick={() => setSelectedDate(date)}
          >
            <div className={`text-sm font-medium mb-1 ${
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
            } ${isToday ? 'text-blue-600' : ''}`}>
              {date.getDate()}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 2).map((event) => (
                <div
                  key={event._id}
                  className={`text-xs p-1 rounded truncate ${
                    eventTypeColors[event.type]
                  }`}
                  title={`${event.title} - ${eventTypeLabels[event.type]}`}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 2 && (
                <div className="text-xs text-gray-500 font-medium">
                  +{dayEvents.length - 2} more
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
          <h1 className="text-3xl font-bold text-gray-900">Project Calendar</h1>
          <p className="text-gray-600 mt-1">Keep track of important project dates and meetings</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/messages">
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Schedule Meeting
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <h2 className="text-xl font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="deadline">Deadlines</SelectItem>
                  <SelectItem value="inspection">Site Visits</SelectItem>
                  <SelectItem value="delivery">Deliveries</SelectItem>
                  <SelectItem value="milestone">Milestones</SelectItem>
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
              {renderMonthView()}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No upcoming events</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Your project manager will schedule meetings and milestones
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event._id} className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0">
                            {event.type === 'meeting' && <Users className="h-4 w-4 text-blue-600" />}
                            {event.type === 'deadline' && <AlertCircle className="h-4 w-4 text-red-600" />}
                            {event.type === 'inspection' && <Eye className="h-4 w-4 text-purple-600" />}
                            {event.type === 'delivery' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {event.type === 'milestone' && <CalendarIcon className="h-4 w-4 text-yellow-600" />}
                          </div>
                          <h3 className="font-medium text-sm text-gray-900">{event.title}</h3>
                        </div>
                        <Badge className={eventTypeColors[event.type]} variant="outline">
                          {eventTypeLabels[event.type]}
                        </Badge>
                      </div>
                      
                      {event.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{event.description}</p>
                      )}
                      
                      <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>
                            {new Date(event.startDate).toLocaleDateString()}
                            {!event.isAllDay && ` at ${new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                        
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        {event.projectTitle && (
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-medium">{event.projectTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(eventTypeLabels).map(([type, label]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 ${eventTypeColors[type as keyof typeof eventTypeColors]}`}></div>
                    <span className="text-sm text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/client/messages" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Schedule a Meeting
                </Button>
              </Link>
              <Link href="/client/projects" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  View Project Timeline
                </Button>
              </Link>
              <Link href="/client/support" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Bell className="h-4 w-4 mr-2" />
                  Set Reminders
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Date Detail Modal */}
      {selectedDate && (
        <Card className="fixed inset-x-4 top-20 z-50 max-w-md mx-auto shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
              ×
            </Button>
          </CardHeader>
          <CardContent>
            {getEventsForDate(selectedDate).length === 0 ? (
              <p className="text-gray-600 text-center py-4">No events scheduled for this day</p>
            ) : (
              <div className="space-y-3">
                {getEventsForDate(selectedDate).map((event) => (
                  <div key={event._id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <Badge className={eventTypeColors[event.type]} variant="outline">
                        {eventTypeLabels[event.type]}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                    <div className="text-xs text-gray-500 space-y-1">
                      {!event.isAllDay && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overlay for modal */}
      {selectedDate && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40" 
          onClick={() => setSelectedDate(null)}
        />
      )}

      {/* Info Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">📅 About Your Project Calendar</h4>
            <p className="text-sm text-blue-700 mb-2">
              This calendar shows important dates for your project including meetings, site visits, delivery dates, and project milestones.
            </p>
            <p className="text-sm text-blue-700">
              Need to schedule a meeting or have questions about any dates? Message your project manager directly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}