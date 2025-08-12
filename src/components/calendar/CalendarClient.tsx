// src/components/calendar/CalendarClient.tsx - NEW CALENDAR COMPONENT
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  Flag
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Define proper TypeScript interfaces
interface ProjectData {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface TaskData {
  _id: string;
  title: string;
  deadline: string;
  status: string;
  priority?: string;
  project?: {
    _id: string;
    title: string;
  };
  assignee?: {
    _id: string;
    name: string;
  };
}

interface MilestoneData {
  _id?: string;
  title?: string;
  name?: string;
  dueDate: string;
  projectTitle: string;
  projectId: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'project' | 'task' | 'milestone';
  status?: string;
  priority?: string;
  projectTitle?: string;
  assignee?: { name: string };
}

interface CalendarClientProps {
  projects: ProjectData[];
  tasks: TaskData[];
  milestones: MilestoneData[];
}

export default function CalendarClient({ projects, tasks, milestones }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  // Convert data to calendar events
  const events: CalendarEvent[] = [
    // Project deadlines
    ...projects.map(project => ({
      id: `project-${project._id}`,
      title: `${project.title} Deadline`,
      date: new Date(project.endDate),
      type: 'project' as const,
      status: project.status
    })),
    // Task deadlines
    ...tasks.map(task => ({
      id: `task-${task._id}`,
      title: task.title,
      date: new Date(task.deadline),
      type: 'task' as const,
      status: task.status,
      priority: task.priority,
      projectTitle: task.project?.title,
      assignee: task.assignee
    })),
    // Milestones
    ...milestones.map(milestone => ({
      id: `milestone-${milestone._id || Math.random()}`,
      title: milestone.name || milestone.title || 'Milestone',
      date: new Date(milestone.dueDate),
      type: 'milestone' as const,
      projectTitle: milestone.projectTitle
    }))
  ];

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get days in month
  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1);
    } else {
      newDate.setMonth(currentMonth + 1);
    }
    setCurrentDate(newDate);
  };

  const getEventColor = (event: CalendarEvent): string => {
    switch (event.type) {
      case 'project':
        return event.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
      case 'task':
        switch (event.priority) {
          case 'urgent': return 'bg-red-100 text-red-800';
          case 'high': return 'bg-orange-100 text-orange-800';
          case 'medium': return 'bg-yellow-100 text-yellow-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      case 'milestone':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (date: Date): boolean => {
    return date < today && date.toDateString() !== today.toDateString();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get upcoming events (next 7 days)
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.date);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return eventDate >= today && eventDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">
            View project deadlines, tasks, and milestones.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'month' ? 'default' : 'outline'}
            onClick={() => setView('month')}
          >
            Month
          </Button>
          <Button
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
          >
            Week
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {monthNames[currentMonth]} {currentYear}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {dayNames.map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const isToday = day.toDateString() === today.toDateString();
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-24 p-1 border rounded ${
                        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className={`text-sm ${
                        isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      } ${isToday ? 'font-bold text-blue-600' : ''}`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate ${getEventColor(event)} ${
                              isOverdue(new Date(event.date)) ? 'opacity-75 line-through' : ''
                            }`}
                            title={`${event.title}${event.projectTitle ? ` - ${event.projectTitle}` : ''}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <p className="text-gray-500 text-sm">No upcoming events in the next 7 days.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} className="border-l-4 border-l-blue-500 pl-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{event.title}</p>
                          {event.projectTitle && (
                            <p className="text-xs text-gray-500">{event.projectTitle}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-600">
                              {formatDate(new Date(event.date))}
                            </span>
                          </div>
                          {event.assignee && (
                            <div className="flex items-center gap-1 mt-1">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {event.assignee.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs">
                            {event.type}
                          </Badge>
                          {event.priority && (
                            <Badge variant="outline" className={`text-xs ${
                              event.priority === 'urgent' ? 'border-red-500 text-red-600' :
                              event.priority === 'high' ? 'border-orange-500 text-orange-600' :
                              'border-gray-500 text-gray-600'
                            }`}>
                              <Flag className="h-2 w-2 mr-1" />
                              {event.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                  <span className="text-sm">Project Deadlines</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                  <span className="text-sm">Urgent Tasks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
                  <span className="text-sm">Milestones</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                  <span className="text-sm">Completed</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}