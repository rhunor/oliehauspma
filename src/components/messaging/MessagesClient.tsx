// src/components/messaging/MessagesClient.tsx - FIXED WITH DUAL MESSAGING SUPPORT
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Send, 
  Search, 
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowLeft,
  Menu,
  X
} from 'lucide-react';

// Define proper TypeScript interfaces
interface MessageSender {
  _id: string;
  name: string;
  role: string;
}

interface MessageRecipient {
  _id: string;
  name: string;
  role: string;
}

interface MessageProject {
  _id: string;
  title: string;
}

interface MessageAttachment {
  filename: string;
  url: string;
  type: string;
}

interface Message {
  _id: string;
  content: string;
  sender: MessageSender;
  recipient: MessageRecipient;
  project?: MessageProject;
  createdAt: string;
  isRead: boolean;
  messageType: 'text' | 'file' | 'system';
  attachments?: MessageAttachment[];
}

interface Conversation {
  participantId: string;
  participantName: string;
  participantRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  projectTitle?: string;
  projectId?: string;
  isOnline: boolean;
}

interface MessagesClientProps {
  userId: string;
  userRole: string;
  userName: string;
}

// API response interfaces
interface ConversationsResponse {
  conversations: Conversation[];
  success: boolean;
}

interface MessagesResponse {
  messages: Message[];
  success: boolean;
}

interface SendMessageResponse {
  message: Message;
  success: boolean;
}

interface ApiError {
  error: string;
  success: false;
}

// Type guard functions
function isApiError(response: unknown): response is ApiError {
  return typeof response === 'object' && response !== null && 'error' in response;
}

function isConversationsResponse(response: unknown): response is ConversationsResponse {
  return typeof response === 'object' && response !== null && 'conversations' in response && 'success' in response;
}

function isMessagesResponse(response: unknown): response is MessagesResponse {
  return typeof response === 'object' && response !== null && 'messages' in response && 'success' in response;
}

function isSendMessageResponse(response: unknown): response is SendMessageResponse {
  return typeof response === 'object' && response !== null && 'message' in response && 'success' in response;
}

export default function MessagesClient({ userId, userRole, userName }: MessagesClientProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/messages/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) 
          ? errorData.error 
          : `Failed to fetch conversations (${response.status})`;
        throw new Error(errorMessage);
      }
      
      const responseData: unknown = await response.json();
      
      if (isConversationsResponse(responseData)) {
        setConversations(responseData.conversations || []);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load conversations';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMessages = useCallback(async (participantId: string) => {
    if (!participantId) return;
    
    setMessagesLoading(true);
    setError(null);
    
    try {
      // Find the conversation to determine if it has a projectId
      const conversation = conversations.find(c => c.participantId === participantId);
      const projectId = conversation?.projectId;

      // Build query parameters based on available data
      const queryParams = new URLSearchParams();
      if (projectId) {
        queryParams.append('projectId', projectId);
      }
      queryParams.append('participantId', participantId);

      const response = await fetch(`/api/messages?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) 
          ? errorData.error 
          : `Failed to fetch messages (${response.status})`;
        throw new Error(errorMessage);
      }
      
      const responseData: unknown = await response.json();
      
      if (isMessagesResponse(responseData)) {
        setMessages(responseData.messages || []);
        
        // Mark messages as read
        try {
          await fetch('/api/messages/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId })
          });

          // Update conversation unread count
          setConversations(prev => 
            prev.map(conv => 
              conv.participantId === participantId 
                ? { ...conv, unreadCount: 0 }
                : conv
            )
          );
        } catch (markReadError) {
          console.warn('Failed to mark messages as read:', markReadError);
          // Don't throw error for mark as read failure
        }
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setMessagesLoading(false);
    }
  }, [conversations, toast]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX
    setSending(true);
    
    try {
      // Find the conversation to determine if it has a projectId
      const conversation = conversations.find(c => c.participantId === selectedConversation);
      const projectId = conversation?.projectId;

      // Build request body based on available data
      const requestBody: {
        recipientId: string;
        content: string;
        messageType: string;
        projectId?: string;
      } = {
        recipientId: selectedConversation,
        content: messageContent,
        messageType: 'text'
      };

      // Only include projectId if it exists
      if (projectId) {
        requestBody.projectId = projectId;
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) 
          ? errorData.error 
          : `Failed to send message (${response.status})`;
        throw new Error(errorMessage);
      }

      const responseData: unknown = await response.json();
      
      if (isSendMessageResponse(responseData)) {
        // Add message to current conversation immediately
        setMessages(prev => [...prev, responseData.message]);
        
        // Update conversations list
        await fetchConversations();
        
        toast({
          title: "Message sent",
          description: "Your message has been delivered",
        });
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      // Restore message content on error
      setNewMessage(messageContent);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConversation, sending, conversations, fetchConversations, toast]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const selectConversation = useCallback((participantId: string) => {
    setSelectedConversation(participantId);
    setShowSidebar(false); // Hide sidebar on mobile after selection
    fetchMessages(participantId);
  }, [fetchMessages]);

  const startNewConversation = useCallback(async () => {
    // This could open a modal to select from available contacts
    toast({
      title: "Feature coming soon",
      description: "Select from available conversations or contact admin to add new contacts",
    });
  }, [toast]);

  const toggleSidebar = useCallback(() => {
    setShowSidebar(prev => !prev);
  }, []);

  const goBackToConversations = useCallback(() => {
    setSelectedConversation(null);
    setShowSidebar(true);
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Filter conversations
  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = conversation.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterBy === 'all' || 
                         (filterBy === 'unread' && conversation.unreadCount > 0) ||
                         (filterBy === 'role' && conversation.participantRole === filterBy);
    
    return matchesSearch && matchesFilter;
  });

  const selectedConversationData = conversations.find(c => c.participantId === selectedConversation);

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.warn('Invalid date string:', dateString);
      return 'Unknown';
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'project_manager': return 'bg-blue-100 text-blue-800';
      case 'client': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadge = (role: string): string => {
    switch (role) {
      case 'super_admin': return 'Admin';
      case 'project_manager': return 'Manager';
      case 'client': return 'Client';
      default: return 'User';
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Messages</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchConversations()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Sidebar - Conversations List */}
      <div className={`
        ${showSidebar || !selectedConversation ? 'flex' : 'hidden'} 
        md:flex flex-col w-full md:w-80 border-r border-gray-200
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="p-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={filterBy === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('all')}
              className="text-xs"
            >
              All
            </Button>
            <Button
              variant={filterBy === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('unread')}
              className="text-xs"
            >
              Unread
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.participantId}
                onClick={() => selectConversation(conversation.participantId)}
                className={`
                  p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors
                  ${selectedConversation === conversation.participantId ? 'bg-blue-50 border-blue-200' : ''}
                `}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {conversation.participantName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.isOnline && (
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.participantName}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(conversation.lastMessageTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage || 'No messages yet'}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <Badge variant="default" className="ml-2 text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className={`text-xs ${getRoleColor(conversation.participantRole)}`}>
                        {getRoleBadge(conversation.participantRole)}
                      </Badge>
                      {conversation.projectTitle && (
                        <Badge variant="outline" className="text-xs">
                          {conversation.projectTitle}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`
        ${selectedConversation ? 'flex' : 'hidden'} 
        md:flex flex-col flex-1
      `}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBackToConversations}
                    className="md:hidden p-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {selectedConversationData?.participantName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedConversationData?.participantName}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${getRoleColor(selectedConversationData?.participantRole || '')}`}>
                        {getRoleBadge(selectedConversationData?.participantRole || '')}
                      </Badge>
                      {selectedConversationData?.isOnline && (
                        <span className="text-xs text-green-600">Online</span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="md:hidden p-2"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </div>
              
              {selectedConversationData?.projectTitle && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    Project: {selectedConversationData.projectTitle}
                  </Badge>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No messages in this conversation</p>
                    <p className="text-sm text-gray-400">Send a message to get started!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.sender._id === userId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-xs lg:max-w-md px-4 py-2 rounded-lg
                      ${message.sender._id === userId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                      }
                    `}>
                      {message.sender._id !== userId && (
                        <div className="text-xs font-medium mb-1 opacity-75">
                          {message.sender.name}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <div className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                        message.sender._id === userId ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {message.sender._id === userId && (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          // No conversation selected
          <div className="hidden md:flex items-center justify-center flex-1">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}