// src/components/chat/ChatContainer.tsx - Fixed All TypeScript Issues
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Send, Paperclip, Smile, MoreVertical, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import FileUpload from './FileUpload';
import type { Message } from '@/types/socket';

interface ChatContainerProps {
  projectId: string;
  recipientId?: string;
  recipientName?: string;
}

export default function ChatContainer({ projectId, recipientId, recipientName }: ChatContainerProps) {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Fixed useRef initialization
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages on component mount
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        projectId,
        ...(recipientId && { recipientId }),
        limit: '50'
      });

      const response = await fetch(`/api/messages?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.data.messages || []);
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load messages'
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, recipientId, toast, scrollToBottom]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !session?.user?.id) return;

    // Join project room
    socket.emit('join_project', projectId);

    // Listen for new messages - Fixed typing to match socket interface
    const handleMessage = (message: Message) => {
      if (message.projectId === projectId) {
        // Check if it&apos;s for current conversation
        const isForConversation = !recipientId || 
          (message.senderId === recipientId && message.recipientId === session.user.id) ||
          (message.senderId === session.user.id && message.recipientId === recipientId);

        if (isForConversation) {
          setMessages(prev => [...prev, message]);
          setTimeout(scrollToBottom, 100);

          // Mark as read if received
          if (message.senderId !== session.user.id) {
            fetch(`/api/messages/${message._id}/read`, { method: 'PATCH' });
          }
        }
      }
    };

    // Listen for typing indicators
    const handleTypingStart = (data: { userId: string; projectId: string }) => {
      if (data.projectId === projectId && data.userId !== session.user.id) {
        setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
      }
    };

    const handleTypingStop = (data: { userId: string; projectId: string }) => {
      if (data.projectId === projectId) {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }
    };

    socket.on('message_received', handleMessage);
    socket.on('user_typing_start', handleTypingStart);
    socket.on('user_typing_stop', handleTypingStop);

    return () => {
      socket.off('message_received', handleMessage);
      socket.off('user_typing_start', handleTypingStart);
      socket.off('user_typing_stop', handleTypingStop);
    };
  }, [socket, session?.user?.id, projectId, recipientId, scrollToBottom]);

  // Handle typing events
  const handleTyping = useCallback(() => {
    if (!socket || !session?.user?.id) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', projectId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', projectId);
    }, 1000);
  }, [socket, session?.user?.id, projectId, isTyping]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !session?.user?.id) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          recipientId,
          content: messageContent,
          messageType: 'text'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && socket) {
          // Fixed: Use recipientId instead of recipient
          socket.emit('send_message', {
            projectId,
            recipientId,
            content: messageContent,
            messageType: 'text'
          });
        }
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message'
      });
      // Restore message on error
      setNewMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = (files: File[]) => {
    // Handle file upload logic here
    console.log('Files to upload:', files);
    setShowFileUpload(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
            {recipientName ? recipientName.charAt(0).toUpperCase() : 'P'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {recipientName || 'Project Chat'}
            </h3>
            <p className="text-sm text-gray-500">
              {recipientId ? 'Direct Message' : 'Project Discussion'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isOwnMessage={message.senderId === session?.user?.id}
            />
          ))
        )}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator userIds={typingUsers} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t">
        <div className="flex items-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFileUpload(!showFileUpload)}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {/* File Upload Area */}
        {showFileUpload && (
          <div className="mt-2">
            <FileUpload onFilesSelected={handleFileUpload} />
          </div>
        )}
      </div>
    </div>
  );
}