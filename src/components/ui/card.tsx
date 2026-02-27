// src/components/ui/card.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border bg-white text-card-foreground transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-neutral-200 shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(107,124,59,0.10),0_2px_8px_-2px_rgba(0,0,0,0.06)]",
        elegant: "border-neutral-200 shadow-[0_2px_12px_-2px_rgba(107,124,59,0.08),0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_-4px_rgba(107,124,59,0.13),0_2px_8px_rgba(0,0,0,0.06)] hover:border-primary-200",
        outline: "border-2 border-neutral-300",
        ghost: "border-transparent shadow-none",
        gradient: "border-transparent bg-gradient-to-br from-primary-50 to-secondary-50",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-6", className)}
    {...props}
  />
));

CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-serif text-xl font-semibold leading-none tracking-tight text-gray-900", className)}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-neutral-600", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));

CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-6", className)}
    {...props}
  />
));

CardFooter.displayName = "CardFooter";

// Specialized card components for common use cases
const StatsCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    trend?: {
      value: number;
      isPositive: boolean;
    };
    className?: string;
  }
>(({ title, value, description, icon, trend, className, ...props }, ref) => (
  <Card
    ref={ref}
    variant="elegant"
    className={cn("hover:scale-105 transition-transform", className)}
    {...props}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-neutral-500 mt-1">{description}</p>
          )}
        </div>
        
        {icon && (
          <div className="ml-4 text-primary-500 opacity-80">
            {icon}
          </div>
        )}
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center">
          <span
            className={cn(
              "text-xs font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.isPositive ? "↗" : "↘"} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-neutral-500 ml-2">vs last period</span>
        </div>
      )}
    </CardContent>
  </Card>
));

StatsCard.displayName = "StatsCard";

const ProjectCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string;
    description: string;
    status: string;
    progress: number;
    dueDate: string;
    client: string;
    manager: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    className?: string;
    onClick?: () => void;
  }
>(({ 
  title, 
  description, 
  status, 
  progress, 
  dueDate, 
  client, 
  manager, 
  priority,
  className,
  onClick,
  ...props 
}, ref) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'planning': return 'text-purple-600 bg-purple-50';
      case 'on_hold': return 'text-gray-600 bg-gray-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card
      ref={ref}
      variant="elegant"
      className={cn(
        "cursor-pointer hover:scale-105 transition-transform",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-serif text-lg font-semibold text-gray-900 truncate">
                {title}
              </h3>
              <div className={cn("w-2 h-2 rounded-full", getPriorityColor(priority))} />
            </div>
            <p className="text-sm text-neutral-600 line-clamp-2">{description}</p>
          </div>
          
          <span className={cn(
            "px-2 py-1 text-xs font-medium rounded-full",
            getStatusColor(status)
          )}>
            {status.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-neutral-600 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs text-neutral-600">
            <div>
              <span className="font-medium">Client:</span> {client}
            </div>
            <div>
              <span className="font-medium">Manager:</span> {manager}
            </div>
          </div>

          <div className="text-xs text-neutral-500">
            <span className="font-medium">Due:</span> {dueDate}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProjectCard.displayName = "ProjectCard";

const TaskCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    deadline: string;
    assignee: string;
    projectName: string;
    className?: string;
    onClick?: () => void;
  }
>(({ 
  title, 
  description, 
  status, 
  priority, 
  deadline, 
  assignee, 
  projectName,
  className,
  onClick,
  ...props 
}, ref) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '⏳';
      case 'blocked': return '🚫';
      default: return '○';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  return (
    <Card
      ref={ref}
      variant="default"
      className={cn(
        "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
        getPriorityColor(priority),
        className
      )}
      onClick={onClick}
      {...props}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusIcon(status)}</span>
            <h4 className="font-medium text-gray-900 truncate">{title}</h4>
          </div>
          <span className="text-xs text-neutral-500 capitalize">{priority}</span>
        </div>

        <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{description}</p>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-500">
            <span><strong>Project:</strong> {projectName}</span>
            <span><strong>Assignee:</strong> {assignee}</span>
          </div>
          <div className="text-xs text-neutral-500">
            <strong>Deadline:</strong> {deadline}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

TaskCard.displayName = "TaskCard";

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  StatsCard,
  ProjectCard,
  TaskCard,
  cardVariants 
};