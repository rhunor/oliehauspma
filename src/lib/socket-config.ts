// src/lib/socket-config.ts - Dynamic socket URL configuration
export const getSocketUrl = (): string => {
  // Check if we have a configured socket URL
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // If running in browser, dynamically determine socket URL
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Use the same host as the current page but on port 3001
    return `http://${currentHost}:3001`;
  }

  // Fallback for server-side
  return 'http://localhost:3001';
};

export const shouldEnableSocket = (): boolean => {
  // Only enable socket if we have a configured URL or in development
  return !!(
    process.env.NEXT_PUBLIC_SOCKET_URL || 
    process.env.NODE_ENV === 'development'
  );
};