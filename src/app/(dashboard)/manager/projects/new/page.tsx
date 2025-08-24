// src/app/(dashboard)/manager/projects/new/page.tsx - FIXED: API permissions and Select issues
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  DollarSign, 
  Users, 
  Tag,
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface FormData {
  title: string;
  description: string;
  clientId: string;
  managerId: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  budget: string;
  tags: string;
  notes: string;
  siteAddress: string;
  scopeOfWork: string;
  designStyle: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function NewProjectPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [usersFetchError, setUsersFetchError] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    clientId: '',
    managerId: session?.user?.id || '', // Auto-select current manager
    status: 'planning',
    priority: 'medium',
    startDate: '',
    endDate: '',
    budget: '',
    tags: '',
    notes: '',
    siteAddress: '',
    scopeOfWork: '',
    designStyle: ''
  });

  // ENHANCED: Fetch users with better error handling and fallback strategies
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setUsersFetchError('');
      
      // Try different endpoints based on user role
      const endpoints = [
        '/api/users?limit=100',
        '/api/users?role=client,project_manager&limit=100',
        '/api/auth/users?limit=100' // Fallback endpoint
      ];

      let users: User[] = [];
      let lastError = '';

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          
          if (response.ok) {
            const data = await response.json();
            
            // Handle different response structures
            if (data.success && data.data) {
              if (data.data.users && Array.isArray(data.data.users)) {
                users = data.data.users;
                break;
              } else if (Array.isArray(data.data)) {
                users = data.data;
                break;
              }
            } else if (Array.isArray(data)) {
              users = data;
              break;
            }
          } else if (response.status === 401) {
            lastError = 'Authentication required';
          } else if (response.status === 403) {
            lastError = 'Insufficient permissions to access users';
          } else {
            const errorData = await response.json().catch(() => ({}));
            lastError = errorData.error || `HTTP ${response.status}`;
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Network error';
          continue; // Try next endpoint
        }
      }

      if (users.length === 0) {
        // If no users fetched, show appropriate message
        if (session?.user.role !== 'super_admin') {
          setUsersFetchError('Only super administrators can access the user directory. Please contact your administrator to create projects.');
        } else {
          setUsersFetchError(lastError || 'No users found');
        }
        return;
      }

      // Filter active users only
      const activeUsers = users.filter(user => user.isActive !== false);
      
      // Set users based on roles
      const clientUsers = activeUsers.filter(user => user.role === 'client');
      const managerUsers = activeUsers.filter(user => user.role === 'project_manager');
      
      setClients(clientUsers);
      setManagers(managerUsers);

      // If current user is a manager and not in the list, add them
      if (session?.user && session.user.role === 'project_manager') {
        const currentUserInList = managerUsers.find(manager => manager._id === session.user.id);
        if (!currentUserInList) {
          const currentUser: User = {
            _id: session.user.id,
            name: session.user.name || 'Current User',
            email: session.user.email || '',
            role: 'project_manager',
            isActive: true
          };
          setManagers(prev => [...prev, currentUser]);
        }
      }
      
    } catch (error) {
      console.error('Error fetching users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUsersFetchError(`Failed to load users: ${errorMessage}`);
      
      // Fallback: Add current user as manager if available
      if (session?.user && session.user.role === 'project_manager') {
        const currentUser: User = {
          _id: session.user.id,
          name: session.user.name || 'Current User',
          email: session.user.email || '',
          role: 'project_manager',
          isActive: true
        };
        setManagers([currentUser]);
      }
    } finally {
      setLoading(false);
    }
  }, [toast, session]);

  useEffect(() => {
    if (session?.user) {
      fetchUsers();
    }
  }, [fetchUsers, session]);

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Project title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Project title must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Project description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'Please select a client';
    }

    if (!formData.managerId) {
      newErrors.managerId = 'Please select a project manager';
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (endDate <= startDate) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (formData.budget && (isNaN(Number(formData.budget)) || Number(formData.budget) < 0)) {
      newErrors.budget = 'Budget must be a valid positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please correct the errors below",
      });
      return;
    }

    setSaving(true);

    try {
      // Prepare project data
      const projectData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        clientId: formData.clientId,
        managerId: formData.managerId,
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        notes: formData.notes.trim() || undefined,
        siteAddress: formData.siteAddress.trim() || undefined,
        scopeOfWork: formData.scopeOfWork.trim() || undefined,
        designStyle: formData.designStyle.trim() || undefined,
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Success",
        description: "Project created successfully!",
      });

      // Redirect to the new project page or projects list
      if (result.data?._id) {
        router.push(`/manager/projects/${result.data._id}`);
      } else {
        router.push('/manager/projects');
      }
      
    } catch (error) {
      console.error('Error creating project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Check access permissions
  if (!session || session.user.role !== 'project_manager') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to create projects.</p>
          <Link href="/manager">
            <Button className="mt-4">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show error if users couldn't be fetched and it's critical
  if (usersFetchError && !loading && clients.length === 0 && managers.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/manager/projects">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
              <p className="text-gray-600">Add a new interior design project to your portfolio</p>
            </div>
          </div>
        </div>

        {/* Error Card */}
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Users</h3>
              <p className="text-gray-600 mb-4">{usersFetchError}</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={fetchUsers} variant="outline">
                  <Loader2 className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Link href="/manager/projects">
                  <Button>Return to Projects</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
            <p className="text-gray-600">Add a new interior design project to your portfolio</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Show warning if users fetch had issues but some data loaded */}
          {usersFetchError && (clients.length > 0 || managers.length > 0) && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Limited User Data</p>
                    <p className="text-sm text-yellow-700">{usersFetchError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter project title"
                    className={errors.title ? 'border-red-500' : ''}
                    maxLength={100}
                  />
                  {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Project Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe the project scope and objectives"
                    rows={4}
                    className={errors.description ? 'border-red-500' : ''}
                    maxLength={500}
                  />
                  {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
                  <p className="text-xs text-gray-500">{formData.description.length}/500 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteAddress">Site Address</Label>
                  <Input
                    id="siteAddress"
                    value={formData.siteAddress}
                    onChange={(e) => handleInputChange('siteAddress', e.target.value)}
                    placeholder="Enter project location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designStyle">Design Style</Label>
                  <Input
                    id="designStyle"
                    value={formData.designStyle}
                    onChange={(e) => handleInputChange('designStyle', e.target.value)}
                    placeholder="e.g., Modern, Traditional, Minimalist"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="scopeOfWork">Scope of Work</Label>
                  <Textarea
                    id="scopeOfWork"
                    value={formData.scopeOfWork}
                    onChange={(e) => handleInputChange('scopeOfWork', e.target.value)}
                    placeholder="Define the detailed scope and deliverables"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client *</Label>
                  <Select value={formData.clientId} onValueChange={(value) => handleInputChange('clientId', value)}>
                    <SelectTrigger className={errors.clientId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length > 0 ? (
                        clients.map((client) => (
                          <SelectItem key={client._id} value={client._id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{client.name}</span>
                              <span className="text-sm text-gray-500">{client.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-clients" disabled>
                          No clients available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.clientId && <p className="text-sm text-red-600">{errors.clientId}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerId">Project Manager *</Label>
                  <Select value={formData.managerId} onValueChange={(value) => handleInputChange('managerId', value)}>
                    <SelectTrigger className={errors.managerId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.length > 0 ? (
                        managers.map((manager) => (
                          <SelectItem key={manager._id} value={manager._id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{manager.name}</span>
                              <span className="text-sm text-gray-500">{manager.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-managers" disabled>
                          No managers available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.managerId && <p className="text-sm text-red-600">{errors.managerId}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: FormData['status']) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: FormData['priority']) => handleInputChange('priority', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Budget
                  </Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    placeholder="0.00"
                    className={errors.budget ? 'border-red-500' : ''}
                  />
                  {errors.budget && <p className="text-sm text-red-600">{errors.budget}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className={errors.endDate ? 'border-red-500' : ''}
                  />
                  {errors.endDate && <p className="text-sm text-red-600">{errors.endDate}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => handleInputChange('tags', e.target.value)}
                    placeholder="tag1, tag2, tag3"
                  />
                  <p className="text-xs text-gray-500">Separate multiple tags with commas</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional notes, requirements, or special considerations"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t">
            <Link href="/manager/projects">
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={saving || clients.length === 0} 
              className="min-w-32"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}