// src/app/(dashboard)/admin/users/page.tsx
"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import UserManagement from "@/components/auth/user-management";
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

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // Callback handlers for user management events
  const handleUserCreated = useCallback((newUser: User) => {
    toast({
      title: "Success",
      description: `User ${newUser.name} has been created successfully`,
    });
  }, [toast]);

  const handleUserUpdated = useCallback((updatedUser: User) => {
    toast({
      title: "Success", 
      description: `User ${updatedUser.name} has been updated successfully`,
    });
  }, [toast]);

  const handleUserDeleted = useCallback((userId: string) => {
    toast({
      title: "Success",
      description: "User has been deleted successfully",
    });
  }, [toast]);

  // Check if user has permission to access this page
  if (!session || session.user.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserManagement
        onUserCreated={handleUserCreated}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
      />
    </div>
  );
}