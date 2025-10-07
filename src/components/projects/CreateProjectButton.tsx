// FILE: src/components/projects/CreateProjectButton.tsx - WITH MULTIPLE MANAGERS SUPPORT
'use client';

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface FormData {
  title: string;
  description: string;
  clientId: string;
  managerIds: string[];
  startDate: string;
  endDate: string;
  budget: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string;
}

export default function CreateProjectButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<User[]>([]);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    clientId: '',
    managerIds: [],
    startDate: '',
    endDate: '',
    budget: '',
    priority: 'medium',
    tags: ''
  });

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const [clientsRes, managersRes] = await Promise.all([
        fetch('/api/users?role=client&limit=100'),
        fetch('/api/users?role=project_manager&limit=100')
      ]);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData.data?.users || clientsData.data || []);
      }

      if (managersRes.ok) {
        const managersData = await managersRes.json();
        setManagers(managersData.data?.users || managersData.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load users',
      });
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.clientId || formData.managerIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields and select at least one manager',
      });
      return;
    }

    try {
      setLoading(true);

      const projectData = {
        title: formData.title,
        description: formData.description,
        clientId: formData.clientId,
        managerIds: formData.managerIds,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        budget: formData.budget ? Number(formData.budget) : undefined,
        priority: formData.priority,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : []
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const data = await response.json();

      toast({
        title: 'Success',
        description: 'Project created successfully',
      });

      setOpen(false);
      setFormData({
        title: '',
        description: '',
        clientId: '',
        managerIds: [],
        startDate: '',
        endDate: '',
        budget: '',
        priority: 'medium',
        tags: ''
      });
      setSelectedManagers([]);

      // Refresh the page or redirect
      router.refresh();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Fill in the project details. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter project description"
              rows={3}
              required
            />
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="clientId">Client *</Label>
            <Select 
              value={formData.clientId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
            >
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
                  <SelectItem value="no-clients" disabled>
                    No clients available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Multiple Managers Selection */}
          <div className="space-y-2">
            <Label htmlFor="managerId">Project Managers *</Label>
            <p className="text-sm text-gray-600">Select one or more project managers</p>
            
            <Select onValueChange={handleAddManager}>
              <SelectTrigger>
                <SelectValue placeholder="Add a manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.length > 0 ? (
                  managers
                    .filter(m => !selectedManagers.find(sm => sm._id === m._id))
                    .map((manager) => (
                      <SelectItem key={manager._id} value={manager._id}>
                        {manager.name} - {manager.email}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="no-managers" disabled>
                    No managers available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Selected Managers Display */}
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

            {selectedManagers.length === 0 && (
              <p className="text-sm text-red-600">Please select at least one manager</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Budget and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: FormData['priority']) => setFormData(prev => ({ ...prev, priority: value }))}
              >
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

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., residential, renovation, urgent"
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
            <Button type="submit" disabled={loading || selectedManagers.length === 0}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}