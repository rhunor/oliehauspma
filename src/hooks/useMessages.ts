// src/hooks/useMessages.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { Message, TypingEventData } from '@/types/socket';

export const useMessages = (projectId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const { socket } = useSocket();

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messages?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Send message
  const sendMessage = useCallback((content: string, recipient?: string) => {
    if (socket && content.trim()) {
      socket.emit('send_message', {
        projectId,
        content: content.trim(),
        messageType: 'text',
        recipient
      });
    }
  }, [socket, projectId]);

  // Start typing
  const startTyping = useCallback(() => {
    if (socket) {
      socket.emit('typing_start', projectId);
    }
  }, [socket, projectId]);

  // Stop typing
  const stopTyping = useCallback(() => {
    if (socket) {
      socket.emit('typing_stop', projectId);
    }
  }, [socket, projectId]);

  useEffect(() => {
    if (projectId) {
      fetchMessages();
    }
  }, [projectId, fetchMessages]);

  useEffect(() => {
    if (socket && projectId) {
      // Join project room
      socket.emit('join_project', projectId);

      // Listen for new messages
      socket.on('message_received', (message: Message) => {
        if (message.projectId === projectId) {
          setMessages(prev => [...prev, message]);
        }
      });

      // Listen for sent messages (confirmation)
      socket.on('message_sent', (message: Message) => {
        if (message.projectId === projectId) {
          setMessages(prev => [...prev, message]);
        }
      });

      // Handle typing indicators
      socket.on('user_typing_start', (data: TypingEventData) => {
        setTypingUsers(prev => new Set([...prev, data.userId]));
      });

      socket.on('user_typing_stop', (data: TypingEventData) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      });

      return () => {
        socket.off('message_received');
        socket.off('message_sent');
        socket.off('user_typing_start');
        socket.off('user_typing_stop');
        socket.emit('leave_project', projectId);
      };
    }
  }, [socket, projectId]);

  return {
    messages,
    loading,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    startTyping,
    stopTyping,
    refetch: fetchMessages
  };
};