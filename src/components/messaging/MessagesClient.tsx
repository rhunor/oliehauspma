// src/components/messaging/MessagesClient.tsx - FIXED WITH PROPER ERROR HANDLING AND TYPE SAFETY
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
  Plus
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
}

interface MessagesResponse {
  messages: Message[];
}

interface SendMessageResponse {
  message: Message;
}

interface ApiError {
  error: string;
}

// Type guard functions
function isApiError(response: unknown): response is ApiError {
  return typeof response === 'object' && response !== null && 'error' in response;
}

function isConversationsResponse(response: unknown): response is ConversationsResponse {
  return typeof response === 'object' && response !== null && 'conversations' in response;
}

function isMessagesResponse(response: unknown): response is MessagesResponse {
  return typeof response === 'object' && response !== null && 'messages' in response;
}

function isSendMessageResponse(response: unknown): response is SendMessageResponse {
  return typeof response === 'object' && response !== null && 'message' in response;
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
      const response = await fetch('/api/messages/conversations');
      
      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) ? errorData.error : 'Failed to fetch conversations';
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
      const response = await fetch(`/api/messages?participantId=${encodeURIComponent(participantId)}`);
      
      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) ? errorData.error : 'Failed to fetch messages';
        throw new Error(errorMessage);
      }
      
      const responseData: unknown = await response.json();
      
      if (isMessagesResponse(responseData)) {
        setMessages(responseData.messages || []);
        
        // Mark messages as read
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
  }, [toast]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX
    setSending(true);
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: messageContent,
          messageType: 'text'
        })
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isApiError(errorData) ? errorData.error : 'Failed to send message';
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
  }, [newMessage, selectedConversation, sending, fetchConversations, toast]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const selectConversation = useCallback((participantId: string) => {
    setSelectedConversation(participantId);
    fetchMessages(participantId);
  }, [fetchMessages]);

  const startNewConversation = useCallback(async () => {
    // This could open a modal to select from available contacts
    toast({
      title: "Feature coming soon",
      description: "Select from available conversations or contact admin to add new contacts",
    });
  }, [toast]);

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
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'project_manager': return 'bg-blue-100 text-blue-800';
      case 'client': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'super_admin': return 'Admin';
      case 'project_manager': return 'Manager';
      case 'client': return 'Client';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] max-h-[800px] bg-white rounded-lg shadow-sm border">
      {/* Conversations Sidebar */}
      <div className="w-1/3 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <Button onClick={startNewConversation} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Button
              variant={filterBy === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterBy('all')}
            >
              All
            </Button>
            <Button
              variant={filterBy === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterBy('unread')}
            >
              Unread
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border-b">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">
                {searchQuery || filterBy !== 'all' ? 
                  'No conversations match your search' : 
                  'No conversations yet'
                }
              </p>
              <Button onClick={startNewConversation} size="sm" className="mt-3">
                Start New Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.participantId}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-l-4 transition-colors ${
                    selectedConversation === conversation.participantId
                      ? 'bg-blue-50 border-l-blue-500'
                      : 'border-l-transparent'
                  }`}
                  onClick={() => selectConversation(conversation.participantId)}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gray-100">
                        {conversation.participantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.isOnline && (
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {conversation.participantName}
                        </p>
                        <Badge className={`text-xs px-1.5 py-0.5 ${getRoleColor(conversation.participantRole)}`}>
                          {getRoleDisplayName(conversation.participantRole)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {conversation.unreadCount > 0 && (
                          <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0.5">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    
                    {conversation.projectTitle && (
                      <p className="text-xs text-blue-600 truncate mt-1">
                        Project: {conversation.projectTitle}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && selectedConversationData ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedConversationData.participantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {selectedConversationData.participantName}
                    </h3>
                    <Badge className={`text-xs ${getRoleColor(selectedConversationData.participantRole)}`}>
                      {getRoleDisplayName(selectedConversationData.participantRole)}
                    </Badge>
                    {selectedConversationData.isOnline && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600">Online</span>
                      </div>
                    )}
                  </div>
                  {selectedConversationData.projectTitle && (
                    <p className="text-sm text-blue-600">
                      Project: {selectedConversationData.projectTitle}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isFromCurrentUser = message.sender._id === userId;
                  return (
                    <div
                      key={message._id}
                      className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isFromCurrentUser
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center justify-between mt-1 text-xs ${
                          isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span>{formatTime(message.createdAt)}</span>
                          {isFromCurrentUser && (
                            <CheckCircle className="h-3 w-3 ml-2" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}