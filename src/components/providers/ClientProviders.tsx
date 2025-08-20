// src/components/providers/ClientProviders.tsx - FIXED: Separate client providers
"use client";

import { SessionProvider } from "next-auth/react";
import { SocketProvider } from "@/contexts/SocketContext";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <SessionProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </SessionProvider>
  );
}