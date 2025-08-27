// src/app/(dashboard)/admin/projects/[id]/edit/page.tsx - PROJECT EDIT PAGE
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
  AlertTriangle
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
  
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
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

  // Fetch project data and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch project details
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
            clientId: data.client._id || '',
            managerId: data.manager._id || ''
          });
        }

        // Fetch users (only for super admin)
        if (!isManager) {
          const [clientsRes, managersRes] = await Promise.all([
            fetch('/api/users?role=client'),
            fetch('/api/users?role=project_manager')
          ]);
          
          if (clientsRes.ok) {
            const clientsData = await clientsRes.json();
            setClients(clientsData.data || []);
          }
          
          if (managersRes.ok) {
            const managersData = await managersRes.json();
            setManagers(managersData.data || []);
          }
        }
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

  const backUrl = isManager ? `/manager/projects/${projectId}` : `/admin/projects/${projectId}`;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link href={backUrl} className="flex-shrink-0 mt-1">
            <Button variant="outline" size="sm" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
              Edit Project
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Update project details and settings
            </p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter project title"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
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

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter project description"
                rows={4}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
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

              <div>
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  placeholder="Enter project budget"
                  className={errors.budget ? 'border-red-500' : ''}
                />
                {errors.budget && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {errors.budget}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="siteAddress">Site Address *</Label>
              <Input
                id="siteAddress"
                value={formData.siteAddress}
                onChange={(e) => handleInputChange('siteAddress', e.target.value)}
                placeholder="Enter site address"
                className={errors.siteAddress ? 'border-red-500' : ''}
              />
              {errors.siteAddress && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.siteAddress}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="scopeOfWork">Scope of Work</Label>
              <Textarea
                id="scopeOfWork"
                value={formData.scopeOfWork}
                onChange={(e) => handleInputChange('scopeOfWork', e.target.value)}
                placeholder="Enter scope of work"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="designStyle">Design Style</Label>
              <Input
                id="designStyle"
                value={formData.designStyle}
                onChange={(e) => handleInputChange('designStyle', e.target.value)}
                placeholder="Enter design style"
              />
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={errors.endDate ? 'border-red-500' : ''}
                />
                {errors.endDate && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {errors.endDate}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="projectDuration">Duration</Label>
                <Input
                  id="projectDuration"
                  value={formData.projectDuration}
                  onChange={(e) => handleInputChange('projectDuration', e.target.value)}
                  placeholder="e.g., 6 months"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignment (Admin only) */}
        {!isManager && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-orange-600" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId">Client *</Label>
                  <Select value={formData.clientId} onValueChange={(value) => handleInputChange('clientId', value)}>
                    <SelectTrigger className={errors.clientId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.name} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clientId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {errors.clientId}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="managerId">Project Manager *</Label>
                  <Select value={formData.managerId} onValueChange={(value) => handleInputChange('managerId', value)}>
                    <SelectTrigger className={errors.managerId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager._id} value={manager._id}>
                          {manager.name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.managerId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {errors.managerId}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Link href={backUrl}>
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}