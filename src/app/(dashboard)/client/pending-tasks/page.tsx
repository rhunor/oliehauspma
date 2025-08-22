// src/app/(dashboard)/client/pending-tasks/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Clock, 
  AlertTriangle, 
  Filter, 
  Calendar,
  User,
  FolderOpen,
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface PendingTask {
  _id: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  estimatedDuration?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  projectTitle: string;
  status: 'pending' | 'in_progress';
  assignedTo?: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
}

interface TaskStats {
  totalPending: number;
  urgent: number;
  highPriority: number;
  dueSoon: number;
  overdue: number;
  inProgress: number;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'structural': return '🏗️';
    case 'electrical': return '⚡';
    case 'plumbing': return '🔧';
    case 'finishing': return '🎨';
    default: return '📋';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'in_progress': return <AlertCircle className="h-4 w-4 text-blue-500" />;
    default: return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

export default function ClientPendingTasksPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Get unique values for filters
  const uniqueProjects = Array.from(new Set(tasks.map(task => task.projectTitle)));
  const uniqueCategories = Array.from(new Set(tasks.map(task => task.category)));

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  const fetchPendingTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pending-tasks?includeStats=true');
      
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data.tasks || []);
        setStats(data.data.stats || null);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load pending tasks"
        });
      }
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while loading tasks"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on current filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.projectTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
    const matchesProject = projectFilter === 'all' || task.projectTitle === projectFilter;
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    return matchesSearch && matchesPriority && matchesCategory && matchesProject && matchesStatus;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) return `${Math.abs(diffInDays)} days overdue`;
    if (diffInDays === 0) return 'Due today';
    if (diffInDays === 1) return 'Due tomorrow';
    return `Due in ${diffInDays} days`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pending tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/client">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pending Tasks</h1>
            <p className="text-gray-600 mt-1">Track upcoming work and deadlines across your projects</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPending}</p>
                </div>
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Urgent</p>
                  <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.highPriority}</p>
                </div>
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Due Soon</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.dueSoon}</p>
                </div>
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.inProgress}</p>
                </div>
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.overdue}</p>
                </div>
                <XCircle className="h-6 w-6 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {uniqueProjects.map(project => (
                  <SelectItem key={project} value={project}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tasks ({filteredTasks.length})</span>
            <Badge variant="outline">{filteredTasks.length} of {tasks.length} tasks</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">
                {tasks.length === 0 
                  ? "You have no pending tasks at the moment."
                  : "Try adjusting your search or filter criteria."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(task.status)}
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{task.projectTitle}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryIcon(task.category)}</span>
                          <span className="text-gray-600 capitalize">{task.category}</span>
                        </div>
                        
                        {task.scheduledDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">{formatDate(task.scheduledDate)}</span>
                          </div>
                        )}
                      </div>
                      
                      {task.scheduledDate && (
                        <div className="mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            new Date(task.scheduledDate) < new Date() 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {formatTimeAgo(task.scheduledDate)}
                          </span>
                        </div>
                      )}
                      
                      {task.assignedTo && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Assigned to: {task.assignedTo}</span>
                        </div>
                      )}
                      
                      {task.estimatedDuration && (
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Est. Duration: {task.estimatedDuration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}