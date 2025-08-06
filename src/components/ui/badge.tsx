// src/components/ui/badge.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-500 text-white hover:bg-primary-600",
        secondary: "border-transparent bg-secondary-500 text-white hover:bg-secondary-600",
        destructive: "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-foreground border-border",
        success: "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning: "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
        info: "border-transparent bg-blue-500 text-white hover:bg-blue-600",
        pending: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        "in-progress": "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
        completed: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        blocked: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
        planning: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200",
        "on-hold": "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200",
        cancelled: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
        low: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        medium: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        high: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200",
        urgent: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Explicitly define BadgeVariant as a union of string literals
type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "pending"
  | "in-progress"
  | "completed"
  | "blocked"
  | "planning"
  | "on-hold"
  | "cancelled"
  | "low"
  | "medium"
  | "high"
  | "urgent";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  dot?: boolean;
}

function Badge({ className, variant, size, icon, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <div className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {icon && <div className="mr-1">{icon}</div>}
      {children}
    </div>
  );
}

// Status Badge Component
interface StatusBadgeProps {
  status: string;
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusVariant = (status: string): BadgeVariant => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'pending';
      case 'in_progress':
      case 'in-progress':
        return 'in-progress';
      case 'completed':
        return 'completed';
      case 'blocked':
        return 'blocked';
      case 'planning':
        return 'planning';
      case 'on_hold':
      case 'on-hold':
        return 'on-hold';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'default';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace('-', ' ');
  };

  return (
    <Badge 
      variant={getStatusVariant(status)} 
      className={className}
    >
      {formatStatus(status)}
    </Badge>
  );
}

// Priority Badge Component
interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const getPriorityVariant = (priority: string): BadgeVariant => {
    switch (priority.toLowerCase()) {
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      case 'urgent':
        return 'urgent';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '🔥';
      case 'high':
        return '⚠️';
      case 'medium':
        return '📋';
      case 'low':
        return '📝';
      default:
        return null;
    }
  };

  return (
    <Badge 
      variant={getPriorityVariant(priority)} 
      className={className}
      icon={getPriorityIcon(priority)}
    >
      {priority}
    </Badge>
  );
}

// Role Badge Component
interface RoleBadgeProps {
  role: string;
  className?: string;
}

function RoleBadge({ role, className }: RoleBadgeProps) {
  const getRoleVariant = (role: string): BadgeVariant => {
    switch (role.toLowerCase()) {
      case 'super_admin':
      case 'super-admin':
        return 'destructive';
      case 'project_manager':
      case 'project-manager':
        return 'default';
      case 'client':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace('-', ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge 
      variant={getRoleVariant(role)} 
      className={className}
    >
      {formatRole(role)}
    </Badge>
  );
}

// Count Badge Component (for notifications, etc.)
interface CountBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

function CountBadge({ count, max = 99, className }: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Badge 
      variant="destructive" 
      size="sm"
      className={cn("h-5 w-5 p-0 justify-center", className)}
    >
      {displayCount}
    </Badge>
  );
}

// Online Status Badge Component
interface OnlineStatusBadgeProps {
  isOnline: boolean;
  className?: string;
}

function OnlineStatusBadge({ isOnline, className }: OnlineStatusBadgeProps) {
  return (
    <Badge 
      variant={isOnline ? "success" : "outline"} 
      dot
      className={className}
    >
      {isOnline ? "Online" : "Offline"}
    </Badge>
  );
}

// Progress Badge Component
interface ProgressBadgeProps {
  progress: number;
  className?: string;
}

function ProgressBadge({ progress, className }: ProgressBadgeProps) {
  const getProgressVariant = (progress: number): BadgeVariant => {
    if (progress === 100) return 'success';
    if (progress >= 75) return 'info';
    if (progress >= 50) return 'warning';
    if (progress >= 25) return 'default';
    return 'outline';
  };

  return (
    <Badge 
      variant={getProgressVariant(progress)} 
      className={className}
    >
      {progress}%
    </Badge>
  );
}

// Deadline Badge Component
interface DeadlineBadgeProps {
  deadline: Date | string;
  className?: string;
}

function DeadlineBadge({ deadline, className }: DeadlineBadgeProps) {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const getDeadlineVariant = (days: number): BadgeVariant => {
    if (days < 0) return 'destructive';
    if (days === 0) return 'warning';
    if (days <= 3) return 'warning';
    if (days <= 7) return 'info';
    return 'success';
  };

  const getDeadlineText = (days: number) => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  return (
    <Badge 
      variant={getDeadlineVariant(daysUntil)} 
      className={className}
    >
      {getDeadlineText(daysUntil)}
    </Badge>
  );
}

export { 
  Badge, 
  StatusBadge, 
  PriorityBadge, 
  RoleBadge, 
  CountBadge, 
  OnlineStatusBadge,
  ProgressBadge,
  DeadlineBadge,
  badgeVariants 
};