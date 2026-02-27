// src/components/chat/FloatingAIChatbot.tsx - FIXED: MINIMAL FLOATING WIDGET, NO ANY TYPES, RESPONSIVE
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  X,
  Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

// FIXED: Proper TypeScript interfaces instead of any
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface AIResponse {
  success: boolean;
  response: string;
  error?: string;
}

interface FloatingAIChatbotProps {
  className?: string;
}

export default function FloatingAIChatbot({ className = '' }: FloatingAIChatbotProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  // FIXED: Proper state typing
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant. How can I help with your project today?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // FIXED: Proper async function typing with comprehensive error handling
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
          projectContext: []
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AIResponse = await response.json() as AIResponse;

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
        throw new Error(data.error || 'Failed to get response');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
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
    }
  };

  // FIXED: Proper event handler typing
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = (): void => {
    setIsOpen(!isOpen);
  };

  // FIXED: Proper utility function typing
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Don't render for non-client users
  if (!session || session.user.role !== 'client') {
    return null;
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[1000] ${className}`}>
      {/* FIXED: Chat Window - Only appears when open */}
      {isOpen && (
        <div 
          className="absolute bottom-16 right-0 w-80 sm:w-96 h-96 sm:h-[500px] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-sm">AI Assistant</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleChat}
              className="h-8 w-8 p-0 hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="w-6 h-6 flex-shrink-0">
                  <AvatarFallback className={
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white text-xs' 
                      : 'bg-gray-200 text-gray-600 text-xs'
                  }>
                    {message.role === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 ${
                  message.role === 'user' ? 'text-right' : ''
                }`}>
                  <div
                    className={`inline-block p-2 rounded-lg max-w-[85%] text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    } ${message.isTyping ? 'animate-pulse' : ''}`}
                  >
                    {message.content}
                    {message.isTyping && (
                      <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 px-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex space-x-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your project..."
                disabled={isLoading}
                className="flex-1 text-sm"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="sm"
                className="px-3 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Floating Button - Always visible in corner */}
      <Button
        onClick={toggleChat}
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        style={{ 
          boxShadow: isOpen ? '0 10px 25px rgba(59, 130, 246, 0.3)' : '0 8px 20px rgba(59, 130, 246, 0.4)' 
        }}
      >
        {isOpen ? (
          <Minimize2 className="h-6 w-6 text-white" />
        ) : (
          <MessageSquare className="h-6 w-6 text-white" />
        )}
      </Button>
    </div>
  );
}