// src/components/chat/RealTimeChat.tsx - FINAL FIX: Compatible with Extended Message Interface
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Paperclip, 
  Phone, 
  Video, 
  MoreVertical,
  Circle,
  CheckCheck,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';

// FIXED: Use the same Message interface from SocketContext to ensure compatibility
interface ChatMessage {
  messageId: string;
  content: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId?: string;
  projectId?: string;
  timestamp: string;
  type?: 'text' | 'file' | 'system';
  isRead: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

// FIXED: Add proper interface for API response instead of using 'any'
interface ApiMessageResponse {
  _id?: string;
  messageId?: string;
  content: string;
  senderId: string;
  recipientId?: string;
  projectId?: string;
  createdAt?: string;
  timestamp?: string;
  type?: 'text' | 'file' | 'system';
  isRead?: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  sender?: {
    name?: string;
    avatar?: string;
  };
}

interface ChatUser {
  _id: string;
  name: string;
  role: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface RealTimeChatProps {
  projectId?: string;
  participantId?: string;
  className?: string;
  height?: string;
}

interface TypingData {
  userId: string;
  projectId?: string;
  isTyping: boolean;
}

export default function RealTimeChat({ 
  projectId, 
  participantId, 
  className = '',
  height = '500px'
}: RealTimeChatProps) {
  const { data: session } = useSession();
  const socket = useSocket();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [participant, setParticipant] = useState<ChatUser | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Transform socket message to chat message - FIXED: Now compatible with Message interface
  const transformSocketMessage = useCallback((socketMsg: ChatMessage): ChatMessage => {
    return {
      messageId: socketMsg.messageId,
      content: socketMsg.content,
      senderId: socketMsg.senderId,
      senderName: socketMsg.senderName || 'Unknown User',
      senderAvatar: socketMsg.senderAvatar,
      recipientId: socketMsg.recipientId,
      projectId: socketMsg.projectId,
      timestamp: socketMsg.timestamp,
      type: socketMsg.type || 'text',
      isRead: socketMsg.isRead,
      attachments: socketMsg.attachments || []
    };
  }, []);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!participantId) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        participantId,
        ...(projectId && { projectId }),
        limit: '50'
      });

      const response = await fetch(`/api/messages?${params}`);
      const data = await response.json();

      if (data.success) {
        // FIXED: Transform API messages to chat messages using proper typing instead of 'any'
        const transformedMessages: ChatMessage[] = (data.data || []).map((msg: ApiMessageResponse) => ({
          messageId: msg._id || msg.messageId || '',
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.sender?.name || 'Unknown User',
          senderAvatar: msg.sender?.avatar,
          recipientId: msg.recipientId,
          projectId: msg.projectId,
          timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
          type: msg.type || 'text',
          isRead: msg.isRead !== undefined ? msg.isRead : false, // FIXED: Ensure isRead has a value
          attachments: msg.attachments || []
        }));
        
        setMessages(transformedMessages);
        
        // Load participant info
        const userResponse = await fetch(`/api/users/${participantId}`);
        const userData = await userResponse.json();
        if (userData.success) {
          setParticipant(userData.data);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, [participantId, projectId]);

  // Join project room and set up socket listeners
  useEffect(() => {
    if (!socket.socket || !session?.user?.id) return;

    setIsConnected(socket.isConnected);

    // Join project room if projectId provided
    if (projectId) {
      socket.joinProject(projectId);
    }

    // FIXED: Message listener now uses compatible Message interface from SocketContext
    const handleNewMessage = (socketMessage: ChatMessage) => {
      if (
        (projectId && socketMessage.projectId === projectId) ||
        (participantId && (
          socketMessage.senderId === participantId || 
          socketMessage.recipientId === participantId
        ))
      ) {
        const chatMessage = transformSocketMessage(socketMessage);
        
        setMessages(prev => {
          // Avoid duplicate messages
          if (prev.some(m => m.messageId === chatMessage.messageId)) {
            return prev;
          }
          return [...prev, chatMessage].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
        
        // Mark message as read if it's not from current user
        if (socketMessage.senderId !== session.user.id) {
          setTimeout(() => markMessageAsRead(chatMessage.messageId), 1000);
        }
      }
    };

    // FIXED: Now the callback signature matches exactly with SocketContext expectations
    const unsubscribeMessages = socket.onNewMessage(handleNewMessage);

    // Set up typing listener with proper typing
    const unsubscribeTyping = socket.onUserTyping((typing: TypingData) => {
      if (
        typing.userId !== session.user.id &&
        ((projectId && typing.projectId === projectId) || typing.userId === participantId)
      ) {
        setTypingUsers(prev => {
          if (typing.isTyping) {
            return prev.includes(typing.userId) ? prev : [...prev, typing.userId];
          } else {
            return prev.filter(id => id !== typing.userId);
          }
        });
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
      if (projectId) {
        socket.leaveProject(projectId);
      }
    };
  }, [socket, session?.user?.id, projectId, participantId, transformSocketMessage]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Handle typing
  const handleTyping = useCallback(() => {
    if (!socket.socket || !projectId) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.startTyping(projectId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.stopTyping(projectId);
    }, 1000);
  }, [socket, projectId, isTyping]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !socket.socket || !session?.user?.id) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    // Stop typing
    if (isTyping && projectId) {
      setIsTyping(false);
      socket.stopTyping(projectId);
    }

    // FIXED: Create message object compatible with extended Message interface
    const messageData = {
      content: messageContent,
      projectId,
      recipientId: participantId,
      type: 'text' as const
    };

    try {
      // Send via socket for real-time delivery
      socket.sendMessage(messageData);

      // Also save to database via API
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [newMessage, socket, session?.user?.id, projectId, participantId, isTyping]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get message status icon
  const getMessageStatusIcon = (message: ChatMessage) => {
    if (message.senderId !== session?.user?.id) return null;

    if (message.isRead) {
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    } else {
      return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  // Format message time
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={className} style={{ height }}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} style={{ height }}>
      {/* Chat Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {participant && (
              <>
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {participant.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    participant.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">
                    {participant.name}
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    {participant.isOnline ? (
                      'Online'
                    ) : participant.lastSeen ? (
                      `Last seen ${formatDistanceToNow(new Date(participant.lastSeen))} ago`
                    ) : (
                      'Offline'
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
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
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="p-0 flex-1">
        <ScrollArea className="flex-1 p-4" style={{ height: `calc(${height} - 140px)` }}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderId === session?.user?.id;
                
                return (
                  <div
                    key={message.messageId}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isOwn 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {!isOwn && message.senderName && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {message.senderName}
                        </p>
                      )}
                      
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      
                      <div className={`flex items-center justify-between mt-1 text-xs ${
                        isOwn ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>{formatMessageTime(message.timestamp)}</span>
                        {getMessageStatusIcon(message)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-xs">
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <Circle className="h-2 w-2 fill-current text-gray-400 animate-bounce" />
                      <Circle className="h-2 w-2 fill-current text-gray-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <Circle className="h-2 w-2 fill-current text-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="pr-10"
            />
          </div>
          
          <Button 
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}