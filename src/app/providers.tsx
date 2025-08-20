'use client'
// src/app/providers.tsx - Fixed Duplicate Declaration


import { SessionProvider } from 'next-auth/react';
import { SocketProvider } from '@/contexts/SocketContext';
import NotificationSystem from '@/components/notifications/NotificationSystem';
import { Toaster } from '@/components/ui/toaster';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <SocketProvider>
        {children}
        <NotificationSystem />
        <Toaster />
      </SocketProvider>
    </SessionProvider>
  );
}