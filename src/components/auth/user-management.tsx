// src/components/auth/user-management.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Search,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  Phone,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { createUserSchema, type CreateUserData } from "@/lib/validation";
import { formatDate, generateInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'project_manager' | 'client';
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserManagementProps {
  users: User[];
  onUserCreated?: (user: User) => void;
  onUserUpdated?: (user: User) => void;
  onUserDeleted?: (userId: string) => void;
}

export default function UserManagement({ 
  users: initialUsers, 
  onUserCreated,
  onUserUpdated,
  onUserDeleted 
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  });

  const [showPassword, setShowPassword] = useState(false);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter(user => user.isActive === isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleCreateUser = async (data: CreateUserData) => {
    try {
      setLoading(true);

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      const newUser: User = {
        _id: result.data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        phone: data.phone,
        avatar: undefined,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setUsers(prev => [newUser, ...prev]);
      setShowCreateModal(false);
      reset();
      
      toast({
        title: "Success",
        description: "User created successfully",
        variant: "default",
      });

      onUserCreated?.(newUser);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      const updatedUser = { ...user, isActive: !user.isActive };
      setUsers(prev => prev.map(u => u._id === user._id ? updatedUser : u));

      toast({
        title: "Success",
        description: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
        variant: "default",
      });

      onUserUpdated?.(updatedUser);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update user";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setUsers(prev => prev.filter(u => u._id !== user._id));

      toast({
        title: "Success",
        description: "User deleted successfully",
        variant: "default",
      });

      onUserDeleted?.(user._id);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete user";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">User Management</h2>
          <p className="text-neutral-600 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="project_manager">Project Manager</option>
              <option value="client">Client</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-900">User</th>
                  <th className="text-left p-4 font-medium text-gray-900">Role</th>
                  <th className="text-left p-4 font-medium text-gray-900">Status</th>
                  <th className="text-left p-4 font-medium text-gray-900">Last Login</th>
                  <th className="text-left p-4 font-medium text-gray-900">Created</th>
                  <th className="text-right p-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {generateInitials(user.name)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <div className="flex items-center gap-1 text-sm text-neutral-600">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-1 text-sm text-neutral-600">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="p-4">
                      <Badge 
                        variant={user.isActive ? "success" : "outline"}
                        className={user.isActive ? "text-green-700 bg-green-100" : "text-gray-700 bg-gray-100"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-neutral-600">
                      {user.lastLogin ? formatDate(user.lastLogin, "MMM dd, yyyy") : "Never"}
                    </td>
                    <td className="p-4 text-sm text-neutral-600">
                      {formatDate(user.createdAt, "MMM dd, yyyy")}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                No users found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create New User</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateModal(false);
                  reset();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
                <Input
                  {...register("name")}
                  label="Full Name"
                  placeholder="Enter full name"
                  error={errors.name?.message}
                  required
                />

                <Input
                  {...register("email")}
                  type="email"
                  label="Email Address"
                  placeholder="Enter email address"
                  error={errors.email?.message}
                  required
                />

                <Input
                  {...register("phone")}
                  type="tel"
                  label="Phone Number"
                  placeholder="+234 801 234 5678"
                  error={errors.phone?.message}
                />

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("role")}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select Role</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="client">Client</option>
                  </select>
                  {errors.role && (
                    <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>
                  )}
                </div>

                <Input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  placeholder="Enter password"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  error={errors.password?.message}
                  required
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateModal(false);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || loading}
                    loading={isSubmitting || loading}
                  >
                    Create User
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}