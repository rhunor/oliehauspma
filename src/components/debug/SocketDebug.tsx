// src/components/debug/SocketDebug.tsx - Debug socket connection
'use client';

import { useSocketSafe } from '@/contexts/SocketContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SocketDebug() {
  const socket = useSocketSafe();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  const handleConnect = () => {
    addLog('Attempting to connect...');
    socket?.connect();
  };

  const handleDisconnect = () => {
    addLog('Disconnecting...');
    socket?.disconnect();
  };

  const handleTestMessage = () => {
    if (socket?.isConnected) {
      addLog('Sending test message...');
      socket.sendMessage({
        content: 'Test message',
        recipientId: 'test',
        type: 'text'
      });
    } else {
      addLog('Cannot send - not connected');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Get socket URL for display
  const getDisplaySocketUrl = () => {
    if (process.env.NEXT_PUBLIC_SOCKET_URL) {
      return process.env.NEXT_PUBLIC_SOCKET_URL;
    }
    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:3001`;
    }
    return 'http://localhost:3001';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Socket.IO Debug Panel
          <Badge variant={socket?.isConnected ? 'default' : 'secondary'}>
            {socket?.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm"><strong>Socket URL:</strong> {getDisplaySocketUrl()}</p>
          <p className="text-sm"><strong>Current Host:</strong> {typeof window !== 'undefined' ? window.location.hostname : 'N/A'}</p>
          <p className="text-sm"><strong>Connection Status:</strong> {socket?.isConnected ? 'Connected' : 'Disconnected'}</p>
          <p className="text-sm"><strong>Socket Available:</strong> {socket ? 'Yes' : 'No'}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleConnect} 
            disabled={socket?.isConnected}
            size="sm"
          >
            Connect
          </Button>
          <Button 
            onClick={handleDisconnect} 
            disabled={!socket?.isConnected}
            variant="outline"
            size="sm"
          >
            Disconnect
          </Button>
          <Button 
            onClick={handleTestMessage} 
            disabled={!socket?.isConnected}
            variant="secondary"
            size="sm"
          >
            Test Message
          </Button>
          <Button 
            onClick={clearLogs} 
            variant="ghost"
            size="sm"
          >
            Clear Logs
          </Button>
        </div>

        {/* Logs */}
        <div className="bg-black text-green-400 p-3 rounded-lg font-mono text-sm h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          )}
        </div>

        {/* Environment Info */}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Environment Details</summary>
          <div className="mt-2 bg-gray-50 p-3 rounded">
            <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
            <p><strong>Socket URL Env:</strong> {process.env.NEXT_PUBLIC_SOCKET_URL || 'Not set'}</p>
            <p><strong>Window Location:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}