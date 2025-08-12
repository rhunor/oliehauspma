// src/components/ui/avatar.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    {...props}
  />
));
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & {
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
  }
>(({ className, src, alt = '', width = 40, height = 40, ...props }, ref) => {
  // Always use Next.js Image component for better performance and optimization
  if (src) {
    return (
      <Image
        ref={ref}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn('aspect-square h-full w-full object-cover', className)}
        {...props}
      />
    );
  }

  // Return null if no src provided instead of using regular img
  return null;
});
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };