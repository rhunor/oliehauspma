// src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { socketManager } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/lib/socket';

export const useSocket = () => {
  const { data: session } = useSession();
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      socketRef.current = socketManager.connect(
        session.user.id,
        session.user.role
      );
    }

    return () => {
      if (socketRef.current) {
        socketManager.disconnect();
      }
    };
  }, [session?.user?.id, session?.user?.role]);

  return {
    socket: socketRef.current,
    isConnected: socketManager.isConnected(),
  };
};

