// src/components/providers.tsx - SAFE: Conditional SocketProvider
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { SocketProvider } from "@/contexts/SocketContext";
import { useEffect, useState } from "react";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [socketEnabled, setSocketEnabled] = useState(false);

  // Only enable socket after component mounts (client-side only)
  useEffect(() => {
    // Add a delay to ensure other providers are ready
    const timer = setTimeout(() => {
      setSocketEnabled(true);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, []);

  return (
    <SessionProvider>
      {socketEnabled ? (
        <SocketProvider>
          {children}
          <Toaster />
        </SocketProvider>
      ) : (
        <>
          {children}
          <Toaster />
        </>
      )}
    </SessionProvider>
  );
}