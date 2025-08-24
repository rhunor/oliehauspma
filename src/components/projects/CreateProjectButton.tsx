// src/components/projects/CreateProjectButton.tsx - FIXED: Array response handling
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
}

export default function CreateProjectButton() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    managerId: '',
    startDate: '',
    endDate: '',
    budget: '',
    priority: 'medium',
    tags: '',
    notes: ''
  });

  // FIXED: Enhanced user fetching with proper error handling
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=100');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      
      // CRITICAL FIX: Handle different response structures from API
      let users: User[] = [];
      
      if (data.success && data.data) {
        // Handle paginated response structure
        if (data.data.users && Array.isArray(data.data.users)) {
          users = data.data.users;
        }
        // Handle direct array response
        else if (Array.isArray(data.data)) {
          users = data.data;
        }
      }
      // Handle direct array response (fallback)
      else if (Array.isArray(data)) {
        users = data;
      }
      
      // ENHANCED: Validate that users is an array before filtering
      if (!Array.isArray(users)) {
        console.warn('Users data is not an array:', users);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid user data format received",
        });
        return;
      }

      // FIXED: Safe filtering with array validation
      const clientUsers = users.filter((user: User) => user && user.role === 'client');
      const managerUsers = users.filter((user: User) => user && user.role === 'project_manager');
      
      setClients(clientUsers);
      setManagers(managerUsers);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users. Please try again.",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchUsers();
    } else {
      // Reset form when closing
      setFormData({
        title: '',
        description: '',
        clientId: '',
        managerId: '',
        startDate: '',
        endDate: '',
        budget: '',
        priority: 'medium',
        tags: '',
        notes: ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!formData.title || !formData.description || !formData.clientId || !formData.managerId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'End date must be after start date',
      });
      return;
    }

    setLoading(true);

    try {
      const projectData = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined
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
        title: 'Success',
        description: 'Project created successfully',
      });
      
      setOpen(false);
      router.refresh(); // Refresh to show new project
      
    } catch (error) {
      console.error('Error creating project:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return formData.title && 
           formData.description && 
           formData.clientId && 
           formData.managerId;
  };

  // Suppress session usage warning - session might be used for auth checks in the future
  if (session) {
    // Session is available for potential future use
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new interior design project to your portfolio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
              placeholder="Enter project title"
              required
            />
          </div>

          {/* Project Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
              placeholder="Enter project description"
              rows={3}
              required
            />
          </div>

          {/* Client and Manager Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <Select value={formData.clientId} onValueChange={(value) => setFormData(prev => ({...prev, clientId: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <SelectItem key={client._id} value={client._id}>
                        {client.name} - {client.email}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-clients" disabled>No clients available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="managerId">Project Manager *</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData(prev => ({...prev, managerId: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.length > 0 ? (
                    managers.map((manager) => (
                      <SelectItem key={manager._id} value={manager._id}>
                        {manager.name} - {manager.email}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-managers" disabled>No managers available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({...prev, priority: value}))}>
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

          {/* Budget and Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({...prev, budget: e.target.value}))}
                placeholder="Enter budget amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({...prev, tags: e.target.value}))}
                placeholder="Enter tags (comma separated)"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
              placeholder="Additional notes or comments"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid()}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}