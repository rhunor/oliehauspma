import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary-500 text-white shadow-sm hover:bg-primary-600 hover:shadow-md",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow-md",
        outline:
          "border-2 border-primary-500 bg-transparent text-primary-500 shadow-sm hover:bg-primary-500 hover:text-white",
        secondary:
          "bg-secondary-500 text-white shadow-sm hover:bg-secondary-600 hover:shadow-md",
        ghost: 
          "text-primary-500 hover:bg-primary-50 hover:text-primary-600",
        link: 
          "text-primary-500 underline-offset-4 hover:underline",
        success:
          "bg-green-500 text-white shadow-sm hover:bg-green-600 hover:shadow-md",
        warning:
          "bg-yellow-500 text-white shadow-sm hover:bg-yellow-600 hover:shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };