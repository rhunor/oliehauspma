'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Eye,
  Edit,
  Download,
  Plus,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ActivityModal from '@/components/ActivityModal'; // New integration

// Interfaces (updated for DailyActivity)
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

export default function AdminSiteSchedulePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<DailyActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/site-schedule/activities?role=admin', { cache: 'no-store' }); // Dynamic, no cache
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

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const projectMatch = selectedProject === 'all' || activity.projectId === selectedProject;
    const statusMatch = selectedStatus === 'all' || activity.status === selectedStatus;
    const searchMatch = searchQuery === '' || 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.contractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return projectMatch && statusMatch && searchMatch;
  });

  // Calculate stats from activities
  const stats = {
    total: filteredActivities.length,
    completed: filteredActivities.filter(a => a.status === 'completed').length,
    inProgress: filteredActivities.filter(a => a.status === 'in_progress').length,
    pending: filteredActivities.filter(a => a.status === 'pending' || a.status === 'to-do').length,
    delayed: filteredActivities.filter(a => a.status === 'delayed').length,
  };

  const handleActivityClick = (activity: DailyActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleSuccess = useCallback(() => {
    fetchActivities(); // Refetch after update
  }, [fetchActivities]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Site Schedule</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage activities and track progress across projects</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/admin/site-schedule/daily" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <Calendar className="h-4 w-4 mr-2" />
              Daily View
            </Button>
          </Link>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Statistics */}
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
            <p className="text-xs sm:text-sm text-gray-600">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search activities..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {/* Dynamically populate from projects if fetched */}
                </SelectContent>
              </Select>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Found</h3>
              <p className="text-gray-600 mb-4">No site activities match your filters.</p>
              <Link href="/admin/site-schedule/daily">
                <Button><Plus className="h-4 w-4 mr-2" /> Add Daily Activity</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredActivities.map((activity) => (
                <div key={activity._id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleActivityClick(activity)}>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{activity.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(activity.status)}
                          <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                            {activity.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm text-gray-600">
                        <div className="truncate">
                          <span className="font-medium">Project:</span>
                          <p className="truncate" title={activity.projectTitle}>{activity.projectTitle}</p>
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Contractor:</span>
                          <p className="truncate">{activity.contractor}</p>
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>
                          <p>{new Date(activity.date).toLocaleDateString()}</p>
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Supervisor:</span>
                          <p className="truncate">{activity.supervisor || 'Not assigned'}</p>
                        </div>
                      </div>
                      {activity.description && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-600 text-sm">Description:</span>
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">{activity.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 lg:flex-col lg:gap-1 flex-shrink-0">
                      <Button variant="outline" size="sm" className="w-full lg:w-auto">
                        <Eye className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">View</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
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