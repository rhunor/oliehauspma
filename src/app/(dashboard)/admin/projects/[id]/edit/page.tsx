// FILE: src/app/(dashboard)/admin/projects/[id]/edit/page.tsx - WITH MULTIPLE MANAGERS
"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  X,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  managerIds: string[];
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
}

interface ProjectSubmitData {
  title: string;
  description: string;
  siteAddress: string;
  scopeOfWork?: string;
  designStyle?: string;
  status: string;
  priority: string;
  projectDuration?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  managerIds?: string[];
}

export default function ProjectEditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const projectId = params?.id as string;
  const isManager = session?.user?.role === 'project_manager';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<User[]>([]);
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
    managerIds: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch users
  const fetchUsers = async () => {
    if (isManager) return;
    
    try {
      const [clientsRes, managersRes] = await Promise.all([
        fetch('/api/users?role=client&limit=100'),
        fetch('/api/users?role=project_manager&limit=100')
      ]);
      
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        const clientUsers = clientsData.data?.users || clientsData.data || [];
        setClients(Array.isArray(clientUsers) ? clientUsers.filter((u: User) => u.isActive !== false) : []);
      }
      
      if (managersRes.ok) {
        const managersData = await managersRes.json();
        const managerUsers = managersData.data?.users || managersData.data || [];
        setManagers(Array.isArray(managerUsers) ? managerUsers.filter((u: User) => u.isActive !== false) : []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch project data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/projects/${projectId}`);
        
        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          
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
            managerIds: data.managers ? data.managers.map((m: User) => m._id) : []
          });
          
          // Set selected managers
          if (data.managers && Array.isArray(data.managers)) {
            setSelectedManagers(data.managers);
          }
        } else {
          throw new Error('Failed to fetch project data');
        }

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

  const handleAddManager = (managerId: string) => {
    const manager = managers.find(m => m._id === managerId);
    if (manager && !selectedManagers.find(m => m._id === managerId)) {
      const newSelectedManagers = [...selectedManagers, manager];
      setSelectedManagers(newSelectedManagers);
      setFormData(prev => ({
        ...prev,
        managerIds: newSelectedManagers.map(m => m._id)
      }));
    }
  };

  const handleRemoveManager = (managerId: string) => {
    const newSelectedManagers = selectedManagers.filter(m => m._id !== managerId);
    setSelectedManagers(newSelectedManagers);
    setFormData(prev => ({
      ...prev,
      managerIds: newSelectedManagers.map(m => m._id)
    }));
  };

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.siteAddress.trim()) newErrors.siteAddress = 'Site address is required';
    if (!isManager && !formData.clientId) newErrors.clientId = 'Client is required';
    if (!isManager && formData.managerIds.length === 0) newErrors.managerIds = 'At least one manager is required';
    
    if (formData.budget && isNaN(Number(formData.budget))) {
      newErrors.budget = 'Budget must be a valid number';
    }
    
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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

      if (!isManager) {
        submitData.clientId = formData.clientId;
        submitData.managerIds = formData.managerIds;
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
        
        router.push(`/admin/projects/${projectId}`);
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter project title"
              />
              {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter project description"
                rows={4}
              />
              {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteAddress">Site Address *</Label>
              <Input
                id="siteAddress"
                value={formData.siteAddress}
                onChange={(e) => handleInputChange('siteAddress', e.target.value)}
                placeholder="Enter site address"
              />
              {errors.siteAddress && <p className="text-sm text-red-600">{errors.siteAddress}</p>}
            </div>

            {!isManager && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client *</Label>
                  <Select value={formData.clientId} onValueChange={(value) => handleInputChange('clientId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.name} - {client.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clientId && <p className="text-sm text-red-600">{errors.clientId}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Project Managers *</Label>
                  <p className="text-sm text-gray-600">Select one or more project managers</p>
                  
                  <Select onValueChange={handleAddManager}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers
                        .filter(m => !selectedManagers.find(sm => sm._id === m._id))
                        .map((manager) => (
                          <SelectItem key={manager._id} value={manager._id}>
                            {manager.name} - {manager.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedManagers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-md">
                      {selectedManagers.map((manager) => (
                        <Badge
                          key={manager._id}
                          variant="secondary"
                          className="flex items-center gap-1 px-3 py-1"
                        >
                          {manager.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveManager(manager._id)}
                            className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {errors.managerIds && <p className="text-sm text-red-600">{errors.managerIds}</p>}
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
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
                />
                {errors.endDate && <p className="text-sm text-red-600">{errors.endDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: ProjectFormData['status']) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value: ProjectFormData['priority']) => handleInputChange('priority', value)}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => handleInputChange('budget', e.target.value)}
                placeholder="Enter project budget"
              />
              {errors.budget && <p className="text-sm text-red-600">{errors.budget}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scopeOfWork">Scope of Work</Label>
              <Textarea
                id="scopeOfWork"
                value={formData.scopeOfWork}
                onChange={(e) => handleInputChange('scopeOfWork', e.target.value)}
                placeholder="Describe the scope of work"
                rows={3}
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

            <div className="space-y-2">
              <Label htmlFor="projectDuration">Project Duration</Label>
              <Input
                id="projectDuration"
                value={formData.projectDuration}
                onChange={(e) => handleInputChange('projectDuration', e.target.value)}
                placeholder="e.g., 6 months, 12 weeks"
              />
            </div>

            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/projects/${projectId}`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}