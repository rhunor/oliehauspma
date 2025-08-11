// src/components/projects/create-project-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Users, Calendar, DollarSign, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Define the validation schema inline to avoid import issues
const createProjectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  clientId: z.string().min(1, "Please select a client"),
  managerId: z.string().min(1, "Please select a project manager"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string()).optional(),
  budget: z.number().optional(),
  notes: z.string().optional(),
});

type CreateProjectData = z.infer<typeof createProjectSchema>;

// User interface
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

// Props interface with updated names
interface CreateProjectModalProps {
  open: boolean;  // Changed from isOpen to open
  onClose: () => void;
  onSuccess?: () => void;  // Changed from onProjectCreated
}

export default function CreateProjectModal({ 
  open, 
  onClose, 
  onSuccess 
}: CreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateProjectData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: "",
      managerId: "",
      startDate: "",
      endDate: "",
      priority: "medium",
      tags: [],
      budget: undefined,
      notes: "",
    },
  });

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users?limit=100');
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();

      if (data.success && data.data?.users) {
        const users = data.data.users;
        setClients(users.filter((user: User) => user.role === 'client'));
        setManagers(users.filter((user: User) => user.role === 'project_manager'));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, fetchUsers]);

  // Handle form submission
  const onSubmit = async (data: CreateProjectData) => {
    try {
      setLoading(true);

      // Transform tags string to array if needed
      const transformedData = {
        ...data,
        tags: data.tags || [],
        budget: data.budget || undefined,
        notes: data.notes || undefined,
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transformedData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create project');
      }

      toast({
        title: "Success",
        description: "Project created successfully",
      });

      reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create project";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    reset();
    onClose();
  };

  // Handle tags input
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const tagsArray = value.split(',').map(tag => tag.trim()).filter(Boolean);
    setValue('tags', tagsArray);
  };

  // Handle budget input
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setValue('budget', value);
    } else {
      setValue('budget', undefined);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <CardHeader className="sticky top-0 bg-white border-b z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Create New Project
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Project Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter project title"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Enter project description"
                  rows={4}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              {/* Client and Manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">
                    Client <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    onValueChange={(value) => setValue("clientId", value)}
                    disabled={loadingUsers}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select Client" />
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
                    <p className="text-sm text-red-500">{errors.clientId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager">
                    Project Manager <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    onValueChange={(value) => setValue("managerId", value)}
                    disabled={loadingUsers}
                  >
                    <SelectTrigger id="manager">
                      <SelectValue placeholder="Select Manager" />
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
                    <p className="text-sm text-red-500">{errors.managerId.message}</p>
                  )}
                </div>
              </div>

              {/* Dates and Budget */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="startDate"
                      type="date"
                      className="pl-10"
                      {...register("startDate")}
                    />
                  </div>
                  {errors.startDate && (
                    <p className="text-sm text-red-500">{errors.startDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    End Date <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="endDate"
                      type="date"
                      className="pl-10"
                      {...register("endDate")}
                    />
                  </div>
                  {errors.endDate && (
                    <p className="text-sm text-red-500">{errors.endDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget (₦)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="budget"
                      type="number"
                      placeholder="0"
                      className="pl-10"
                      onChange={handleBudgetChange}
                    />
                  </div>
                  {errors.budget && (
                    <p className="text-sm text-red-500">{errors.budget.message}</p>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  defaultValue="medium"
                  onValueChange={(value) => setValue("priority", value as CreateProjectData["priority"])}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                {errors.priority && (
                  <p className="text-sm text-red-500">{errors.priority.message}</p>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  type="text"
                  placeholder="residential, luxury, modern"
                  onChange={handleTagsChange}
                />
                <p className="text-xs text-gray-500">Enter tags separated by commas</p>
                {errors.tags && (
                  <p className="text-sm text-red-500">{errors.tags.message}</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  <FileText className="inline-block h-4 w-4 mr-1" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes or requirements"
                  rows={3}
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-sm text-red-500">{errors.notes.message}</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || loadingUsers}
                >
                  {loading ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}