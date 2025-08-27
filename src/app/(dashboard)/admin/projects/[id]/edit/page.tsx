// src/app/(dashboard)/admin/projects/[id]/edit/page.tsx - FIXED VERSION
"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  MapPin,
  User,
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface ProjectFormData {
  title: string;
  description: string;
  siteAddress: string;
  scopeOfWork: string;
  designStyle: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  projectDuration: string;
  budget: string;
  clientId: string;
  managerId: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
}

interface ProjectSubmitData extends Omit<ProjectFormData, 'budget' | 'startDate' | 'endDate' | 'clientId' | 'managerId'> {
  budget?: number;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  managerId?: string;
}

export default function ProjectEditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const projectId = params?.id as string;
  const isManager = session?.user?.role === 'project_manager';
  
  // State management - FIXED: Proper array initialization
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<User[]>([]); // FIXED: Initialize as empty array
  const [managers, setManagers] = useState<User[]>([]); // FIXED: Initialize as empty array
  const [usersFetchError, setUsersFetchError] = useState<string>('');
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    siteAddress: '',
    scopeOfWork: '',
    designStyle: '',
    status: 'planning',
    priority: 'medium',
    startDate: '',
    endDate: '',
    projectDuration: '',
    budget: '',
    clientId: '',
    managerId: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // FIXED: Enhanced user fetching with better error handling
  const fetchUsers = async () => {
    if (isManager) return; // Managers don't need to fetch users for editing
    
    try {
      setUsersFetchError(''); // Clear previous errors
      
      const [clientsRes, managersRes] = await Promise.all([
        fetch('/api/users?role=client&limit=100'),
        fetch('/api/users?role=project_manager&limit=100')
      ]);
      
      // Handle clients response
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        if (clientsData.success && clientsData.data) {
          // FIXED: Handle different response structures
          const clientUsers = clientsData.data.users || clientsData.data || [];
          setClients(Array.isArray(clientUsers) ? clientUsers.filter((u: User) => u.isActive !== false) : []);
        } else {
          console.warn('Invalid clients response structure:', clientsData);
          setClients([]);
        }
      } else {
        console.error('Failed to fetch clients:', clientsRes.status, clientsRes.statusText);
        setClients([]);
      }
      
      // Handle managers response
      if (managersRes.ok) {
        const managersData = await managersRes.json();
        if (managersData.success && managersData.data) {
          // FIXED: Handle different response structures
          const managerUsers = managersData.data.users || managersData.data || [];
          setManagers(Array.isArray(managerUsers) ? managerUsers.filter((u: User) => u.isActive !== false) : []);
        } else {
          console.warn('Invalid managers response structure:', managersData);
          setManagers([]);
        }
      } else {
        console.error('Failed to fetch managers:', managersRes.status, managersRes.statusText);
        setManagers([]);
      }
      
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsersFetchError(error instanceof Error ? error.message : 'Failed to fetch users');
      // Ensure arrays are still initialized on error
      setClients([]);
      setManagers([]);
    }
  };

  // Fetch project data and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch project details first
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
          const project = await projectResponse.json();
          const data = project.data;
          
          setFormData({
            title: data.title || '',
            description: data.description || '',
            siteAddress: data.siteAddress || '',
            scopeOfWork: data.scopeOfWork || '',
            designStyle: data.designStyle || '',
            status: data.status || 'planning',
            priority: data.priority || 'medium',
            startDate: data.startDate ? data.startDate.split('T')[0] : '',
            endDate: data.endDate ? data.endDate.split('T')[0] : '',
            projectDuration: data.projectDuration || '',
            budget: data.budget?.toString() || '',
            clientId: data.client?._id || '',
            managerId: data.manager?._id || ''
          });
        } else {
          throw new Error('Failed to fetch project data');
        }

        // Fetch users for super admin
        await fetchUsers();
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load project data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (projectId && session?.user) {
      fetchData();
    }
  }, [projectId, session, isManager, toast]);

  // Handle input changes
  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.siteAddress.trim()) newErrors.siteAddress = 'Site address is required';
    if (!isManager && !formData.clientId) newErrors.clientId = 'Client is required';
    if (!isManager && !formData.managerId) newErrors.managerId = 'Manager is required';
    
    if (formData.budget && isNaN(Number(formData.budget))) {
      newErrors.budget = 'Budget must be a valid number';
    }
    
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      const submitData: ProjectSubmitData = {
        title: formData.title,
        description: formData.description,
        siteAddress: formData.siteAddress,
        scopeOfWork: formData.scopeOfWork,
        designStyle: formData.designStyle,
        status: formData.status,
        priority: formData.priority,
        projectDuration: formData.projectDuration,
        budget: formData.budget ? Number(formData.budget) : undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };

      // Add client/manager fields for super admin
      if (!isManager) {
        submitData.clientId = formData.clientId;
        submitData.managerId = formData.managerId;
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project updated successfully.",
        });
        
        // Navigate back to project detail page
        const backUrl = isManager ? `/manager/projects/${projectId}` : `/admin/projects/${projectId}`;
        router.push(backUrl);
      } else {
        throw new Error('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Error state for critical user fetch failure (only for super admin)
  if (usersFetchError && !loading && !isManager && clients.length === 0 && managers.length === 0) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/projects">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
              <p className="text-gray-600">Modify project details and settings</p>
            </div>
          </div>
        </div>

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
                <Link href="/admin/projects">
                  <Button>Return to Projects</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backUrl = isManager ? `/manager/projects/${projectId}` : `/admin/projects/${projectId}`;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
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
            <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
            <p className="text-gray-600">Modify project details and settings</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: ProjectFormData['status']) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteAddress">Site Address *</Label>
              <Input
                id="siteAddress"
                value={formData.siteAddress}
                onChange={(e) => handleInputChange('siteAddress', e.target.value)}
                className={errors.siteAddress ? 'border-red-500' : ''}
              />
              {errors.siteAddress && <p className="text-sm text-red-500">{errors.siteAddress}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scopeOfWork">Scope of Work</Label>
                <Textarea
                  id="scopeOfWork"
                  value={formData.scopeOfWork}
                  onChange={(e) => handleInputChange('scopeOfWork', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="designStyle">Design Style</Label>
                <Input
                  id="designStyle"
                  value={formData.designStyle}
                  onChange={(e) => handleInputChange('designStyle', e.target.value)}
                  placeholder="e.g., Modern, Contemporary, Traditional"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline & Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline & Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {errors.endDate && <p className="text-sm text-red-500">{errors.endDate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectDuration">Project Duration</Label>
                <Input
                  id="projectDuration"
                  value={formData.projectDuration}
                  onChange={(e) => handleInputChange('projectDuration', e.target.value)}
                  placeholder="e.g., 3 months, 12 weeks"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (₦)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  className={errors.budget ? 'border-red-500' : ''}
                />
                {errors.budget && <p className="text-sm text-red-500">{errors.budget}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value: ProjectFormData['priority']) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Assignment - Only for Super Admin */}
        {!isManager && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={formData.clientId} onValueChange={(value) => handleInputChange('clientId', value)}>
                    <SelectTrigger className={errors.clientId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* FIXED: Safe array rendering with proper checks */}
                      {Array.isArray(clients) && clients.length > 0 ? (
                        clients.map((client) => (
                          <SelectItem key={client._id} value={client._id}>
                            {client.name} ({client.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          {usersFetchError ? 'Error loading clients' : 'No clients available'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.clientId && <p className="text-sm text-red-500">{errors.clientId}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager">Project Manager *</Label>
                  <Select value={formData.managerId} onValueChange={(value) => handleInputChange('managerId', value)}>
                    <SelectTrigger className={errors.managerId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* FIXED: Safe array rendering with proper checks */}
                      {Array.isArray(managers) && managers.length > 0 ? (
                        managers.map((manager) => (
                          <SelectItem key={manager._id} value={manager._id}>
                            {manager.name} ({manager.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          {usersFetchError ? 'Error loading managers' : 'No managers available'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.managerId && <p className="text-sm text-red-500">{errors.managerId}</p>}
                </div>
              </div>

              {/* Show retry button if user fetch failed */}
              {usersFetchError && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 flex-1">{usersFetchError}</p>
                  <Button onClick={fetchUsers} variant="outline" size="sm">
                    <Loader2 className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <Button type="submit" disabled={saving} className="flex-1 sm:flex-initial">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Link href={backUrl} className="flex-1 sm:flex-initial">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}