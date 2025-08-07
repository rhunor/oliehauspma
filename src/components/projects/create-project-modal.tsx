// src/components/projects/create-project-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  createProjectSchema, 
  type CreateProjectData,
  transformTagsToArray,
  transformBudget 
} from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Project {
  _id: string;
  title: string;
  description: string;
  clientId: string;
  managerId: string;
  startDate: string;
  endDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
  budget?: number;
  notes?: string;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export default function CreateProjectModal({ 
  isOpen, 
  onClose, 
  onProjectCreated 
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

  interface UserApiResponse {
    success: boolean;
    data: {
      users: User[];
    };
  }

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users?limit=100');
      const data: UserApiResponse = await response.json();

      if (data.success) {
        const users = data.data.users;
        setClients(users.filter((user) => user.role === 'client'));
        setManagers(users.filter((user) => user.role === 'project_manager'));
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
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const onSubmit: SubmitHandler<CreateProjectData> = async (data) => {
    try {
      setLoading(true);

      // Transform the data before sending to API
      const transformedData = {
        ...data,
        // Ensure data is in the correct format for the API
        tags: Array.isArray(data.tags) ? data.tags : [],
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
        if (result.details) {
          // Handle validation errors
          result.details.forEach((detail: { field: string; message: string }) => {
            console.error(`Validation error on ${detail.field}: ${detail.message}`);
          });
        }
        throw new Error(result.error || 'Failed to create project');
      }

      toast({
        title: "Success",
        description: "Project created successfully",
        variant: "default",
      });

      onProjectCreated?.(result.data as Project);
      handleClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create project";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Handle tags input change
  const handleTagsChange = (value: string) => {
    const tagsArray = transformTagsToArray(value);
    setValue('tags', tagsArray);
  };

  // Handle budget input change
  const handleBudgetChange = (value: string) => {
    const budgetValue = transformBudget(value);
    setValue('budget', budgetValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Project
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              {...register("title")}
              label="Project Title"
              placeholder="Enter project title"
              error={errors.title?.message}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register("description")}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={4}
                placeholder="Enter project description"
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("clientId")}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={loadingUsers}
                >
                  <option value="">Select Client</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-sm text-red-600 mt-1">{errors.clientId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Manager <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("managerId")}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={loadingUsers}
                >
                  <option value="">Select Manager</option>
                  {managers.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
                {errors.managerId && (
                  <p className="text-sm text-red-600 mt-1">{errors.managerId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                {...register("startDate")}
                type="date"
                label="Start Date"
                error={errors.startDate?.message}
                required
              />

              <Input
                {...register("endDate")}
                type="date"
                label="End Date"
                error={errors.endDate?.message}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget (₦)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                  onChange={(e) => handleBudgetChange(e.target.value)}
                />
                {errors.budget && (
                  <p className="text-sm text-red-600 mt-1">{errors.budget.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                {...register("priority")}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              {errors.priority && (
                <p className="text-sm text-red-600 mt-1">{errors.priority.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="residential, luxury, modern"
                onChange={(e) => handleTagsChange(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Enter tags separated by commas</p>
              {errors.tags && (
                <p className="text-sm text-red-600 mt-1">{errors.tags.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                {...register("notes")}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                placeholder="Additional notes or requirements"
              />
              {errors.notes && (
                <p className="text-sm text-red-600 mt-1">{errors.notes.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || loadingUsers}
                loading={loading}
              >
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}