// src/components/chat/AIchatbot.tsx - FIXED: NO ANY TYPES, PROPER TYPESCRIPT, ESLINT COMPLIANT
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  RefreshCw, 
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

// FIXED: Proper TypeScript interfaces instead of any
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface ProjectContext {
  _id: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  startDate?: string;
  endDate?: string;
  manager: {
    name: string;
    email: string;
  };
}

interface AIchatbotResponse {
  success: boolean;
  response: string;
  error?: string;
}

interface AIchatbotProps {
  className?: string;
  defaultMinimized?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'center';
}

export default function AIchatbot({ 
  className = '', 
  defaultMinimized = true,
  position = 'bottom-right' 
}: AIchatbotProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  // FIXED: Proper state typing
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant for OliveHaus Interior Design. How can I help you with your project today?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(defaultMinimized);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [projectContext, setProjectContext] = useState<ProjectContext[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch client's project context for AI
  const fetchProjectContext = useCallback(async (): Promise<void> => {
    if (!session?.user?.id || session.user.role !== 'client') return;

    try {
      const response = await fetch('/api/projects?client=true&limit=5');
      if (response.ok) {
        const data: { success: boolean; data: { data: ProjectContext[] } } = await response.json();
        setProjectContext(data.data.data || []);
      } else {
        toast({
          title: 'Project context unavailable',
          description: 'Could not load your project details. The assistant will still work but without project-specific context.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching project context:', error);
      toast({
        title: 'Connection issue',
        description: 'Could not load project context for the assistant.',
        variant: 'destructive',
      });
    }
  }, [session?.user?.id, session?.user?.role, toast]);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (session?.user?.role === 'client') {
      fetchProjectContext();
    }
  }, [session, fetchProjectContext]);

  // FIXED: Proper async function typing with error handling
  const sendMessage = async (): Promise<void> => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    // Add typing indicator
    const typingMessage: ChatMessage = {
      id: 'typing',
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
      isTyping: true,
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          clientId: session?.user?.id,
          clientName: session?.user?.name,
          projectContext: projectContext.map(project => ({
            title: project.title,
            status: project.status,
            progress: project.progress,
            manager: project.manager?.name || 'Not assigned',
            timeline: project.startDate && project.endDate 
              ? `${project.startDate} to ${project.endDate}` 
              : 'Not specified'
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AIchatbotResponse = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };

        // Remove typing indicator and add real message
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== 'typing');
          return [...filtered, assistantMessage];
        });
      } else {
        throw new Error(data.error || 'Failed to get response from AI');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact your project manager for assistance.',
        timestamp: new Date(),
      };

      // Remove typing indicator and add error message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== 'typing');
        return [...filtered, errorMessage];
      });

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // FIXED: Proper event handler typing
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = (): void => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hi! I\'m your AI assistant for OliveHaus Interior Design. How can I help you with your project today?',
        timestamp: new Date(),
      }
    ]);
  };

  const toggleMinimized = (): void => {
    setIsMinimized(!isMinimized);
    if (!isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // FIXED: Proper utility function typing
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
  };

  // Don't render for non-client users
  if (!session || session.user.role !== 'client') {
    return null;
  }

  return (
    <div className={`fixed z-50 ${positionClasses[position]} ${className}`}>
      <Card className={`w-80 sm:w-96 shadow-xl transition-all duration-300 ${
        isMinimized ? 'h-16' : 'h-96 sm:h-[500px]'
      }`}>
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 py-3 border-b">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Bot className="h-6 w-6 text-primary" />
              {isTyping && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              title="Clear chat"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMinimized}
              className="h-8 w-8 p-0"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <div className="h-80 sm:h-96 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className={
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary'
                      }>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className={`flex-1 space-y-1 ${
                      message.role === 'user' ? 'text-right' : ''
                    }`}>
                      <div
                        className={`inline-block p-3 rounded-lg max-w-[85%] ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground ml-auto'
                            : 'bg-secondary text-secondary-foreground'
                        } ${message.isTyping ? 'animate-pulse' : ''}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                          {message.isTyping && (
                            <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your projects..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  size="sm"
                  className="px-3"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}