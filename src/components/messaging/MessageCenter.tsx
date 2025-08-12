// src/components/messaging/MessageCenter.tsx (Fixed version)
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMessages } from '@/hooks/useMessages';
import { formatTimeAgo } from '@/lib/utils';

interface MessageCenterProps {
  projectId: string;
  projectTitle: string;
}

export default function MessageCenter({ projectId, projectTitle }: MessageCenterProps) {
  const { data: session } = useSession();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Fix: Initialize with null

  const {
    messages,
    loading,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping
  } = useMessages(projectId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newMessage.trim() && session?.user) {
      sendMessage(newMessage.trim());
      setNewMessage('');
      stopTyping();
      setIsTyping(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping();
    }, 2000);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Project Messages - {projectTitle}</span>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
          {loading ? (
            <div className="text-center text-gray-500 py-8">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message._id}
                className={`flex gap-3 ${
                  message.sender._id === session?.user?.id ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={message.sender.avatar} />
                  <AvatarFallback className="text-xs">
                    {getInitials(message.sender.name)}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 max-w-xs ${
                  message.sender._id === session?.user?.id ? 'text-right' : ''
                }`}>
                  <div className={`rounded-lg p-3 ${
                    message.sender._id === session?.user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-100'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {message.sender.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(new Date(message.createdAt))}
                    </span>
                    {!message.isRead && message.sender._id === session?.user?.id && (
                      <span className="text-xs text-gray-400">Sent</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Typing Indicators */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
              <span>
                {typingUsers.length === 1 
                  ? 'Someone is typing...' 
                  : `${typingUsers.length} people are typing...`
                }
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="pr-20"
                disabled={!session?.user}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <Paperclip className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <Smile className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || !session?.user}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}