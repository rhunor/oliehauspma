// src/app/(dashboard)/admin/projects/[id]/milestones/page.tsx - FUNCTIONAL VERSION
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Target,
  CheckCircle,
  Clock,
  AlertTriangle,
  Edit,
  Trash2,
  User,
  RefreshCcw,
  Loader2,
  Filter,
  Download,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Milestone {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface MilestonesData {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
}

interface CreateMilestoneForm {
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  dependencies: string[];
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export default function MilestonesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const projectId = params?.id as string;
  const userRole = session?.user?.role;
  
  // State management
  const [loading, setLoading] = useState(true);
  const [milestonesData, setMilestonesData] = useState<MilestonesData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [formData, setFormData] = useState<CreateMilestoneForm>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    assignedTo: '',
    dependencies: []
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch milestones data
  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/milestones`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMilestonesData(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch milestones');
        }
      } else {
        throw new Error(`HTTP ${response.status}: Failed to fetch milestones`);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load milestones",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  // Fetch users for assignment
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users?role=project_manager,client&limit=50');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const userData = result.data.users || result.data || [];
          setUsers(Array.isArray(userData) ? userData.filter((u: User) => u.role !== 'super_admin') : []);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    if (projectId && session?.user) {
      fetchMilestones();
      fetchUsers();
    }
  }, [projectId, session, fetchMilestones, fetchUsers]);

  // Handle form input changes
  const handleFormChange = (field: keyof CreateMilestoneForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate create form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.dueDate) errors.dueDate = 'Due date is required';
    
    const dueDate = new Date(formData.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      errors.dueDate = 'Due date cannot be in the past';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle milestone creation
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors before creating the milestone",
      });
      return;
    }

    try {
      setCreating(true);
      
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          dueDate: formData.dueDate,
          priority: formData.priority,
          assignedTo: formData.assignedTo || undefined,
          dependencies: formData.dependencies
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Milestone created successfully",
        });
        
        // Reset form and close dialog
        setFormData({
          title: '',
          description: '',
          dueDate: '',
          priority: 'medium',
          assignedTo: '',
          dependencies: []
        });
        setCreateDialogOpen(false);
        
        // Refresh milestones
        fetchMilestones();
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create milestone');
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create milestone",
      });
    } finally {
      setCreating(false);
    }
  };

  // Get status icon and color
  const getStatusInfo = (status: Milestone['status']) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100', label: 'Completed' };
      case 'in_progress':
        return { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'In Progress' };
      case 'overdue':
        return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-100', label: 'Overdue' };
      default:
        return { icon: Target, color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Upcoming' };
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: Milestone['priority']) => {
    const variants = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    
    return (
      <Badge className={variants[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  // Filter milestones
  const filteredMilestones = milestonesData?.milestones?.filter(milestone => {
    const statusMatch = statusFilter === 'all' || milestone.status === statusFilter;
    const priorityMatch = priorityFilter === 'all' || milestone.priority === priorityFilter;
    return statusMatch && priorityMatch;
  }) || [];

  // Calculate statistics
  const stats = milestonesData?.milestones ? {
    total: milestonesData.milestones.length,
    completed: milestonesData.milestones.filter(m => m.status === 'completed').length,
    inProgress: milestonesData.milestones.filter(m => m.status === 'in_progress').length,
    upcoming: milestonesData.milestones.filter(m => m.status === 'upcoming').length,
    overdue: milestonesData.milestones.filter(m => m.status === 'overdue').length,
  } : { total: 0, completed: 0, inProgress: 0, upcoming: 0, overdue: 0 };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate days until due
  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days left`;
  };

  const canCreateMilestones = ['super_admin', 'project_manager'].includes(userRole || '');
  const backUrl = userRole === 'project_manager' ? `/manager/projects/${projectId}` : `/admin/projects/${projectId}`;

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
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
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Project Milestones</h1>
            <p className="text-gray-600">{milestonesData?.projectTitle}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={fetchMilestones} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {canCreateMilestones && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleCreateMilestone}>
                  <DialogHeader>
                    <DialogTitle>Create New Milestone</DialogTitle>
                    <DialogDescription>
                      Add a new milestone to track project progress
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleFormChange('title', e.target.value)}
                        className={formErrors.title ? 'border-red-500' : ''}
                        placeholder="Enter milestone title"
                      />
                      {formErrors.title && <p className="text-sm text-red-500">{formErrors.title}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        placeholder="Describe the milestone objectives"
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => handleFormChange('dueDate', e.target.value)}
                          className={formErrors.dueDate ? 'border-red-500' : ''}
                        />
                        {formErrors.dueDate && <p className="text-sm text-red-500">{formErrors.dueDate}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={formData.priority} onValueChange={(value: CreateMilestoneForm['priority']) => handleFormChange('priority', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="assignedTo">Assign To</Label>
                      <Select value={formData.assignedTo} onValueChange={(value) => handleFormChange('assignedTo', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user._id} value={user._id}>
                              {user.name} ({user.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        'Create Milestone'
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.upcoming}</div>
            <div className="text-sm text-gray-600">Upcoming</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
            <div className="text-sm text-gray-600">Overdue</div>
          </CardContent>
        </Card>
      </div>

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
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        {filteredMilestones.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Milestones Found</h3>
              <p className="text-gray-600 mb-4">
                {milestonesData?.milestones.length === 0 
                  ? "This project doesn't have any milestones yet."
                  : "No milestones match your current filters."
                }
              </p>
              {canCreateMilestones && milestonesData?.milestones.length === 0 && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Milestone
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredMilestones.map((milestone) => {
            const statusInfo = getStatusInfo(milestone.status);
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card key={milestone._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                          <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{milestone.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className={statusInfo.color}>{statusInfo.label}</span>
                            <span>•</span>
                            <span>{getDaysUntilDue(milestone.dueDate)}</span>
                            <span>•</span>
                            <span>{formatDate(milestone.dueDate)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {milestone.description && (
                        <p className="text-gray-600 mb-4 ml-11">{milestone.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 ml-11">
                        {getPriorityBadge(milestone.priority)}
                        
                        {milestone.assignedTo && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <User className="h-3 w-3" />
                            <span>{milestone.assignedTo.name}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Progress:</span>
                          <div className="w-20">
                            <Progress value={milestone.progress} className="h-2" />
                          </div>
                          <span className="text-sm text-gray-600">{milestone.progress}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {canCreateMilestones && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}