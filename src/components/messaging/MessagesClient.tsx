// src/components/messaging/MessagesClient.tsx - FULLY RESPONSIVE WITH MOBILE-FIRST DESIGN
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

export default function MessagesClient({ userId }: MessagesClientProps) {
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
      <div className="flex items-center justify-center min-h-screen sm:min-h-96 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm sm:text-base">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen sm:h-[calc(100vh-12rem)] max-h-[100vh] sm:max-h-[800px] bg-white sm:rounded-lg shadow-sm border relative overflow-hidden">
      
      {/* Mobile Menu Button - Only visible on mobile when conversation is selected */}
      {selectedConversation && (
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 z-50 md:hidden bg-white/90 backdrop-blur-sm shadow-sm"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      {/* Conversations Sidebar */}
      <div className={`
        ${showSidebar || !selectedConversation ? 'translate-x-0' : '-translate-x-full'}
        ${selectedConversation ? 'absolute inset-y-0 left-0 z-40' : 'relative'}
        w-full sm:w-80 md:w-1/3 lg:w-96 xl:w-80 2xl:w-96
        bg-white border-r 
        flex flex-col 
        transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-auto
      `}>
        
        {/* Header */}
        <div className="p-3 sm:p-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Messages</h2>
            <div className="flex items-center gap-2">
              <Button onClick={startNewConversation} size="sm" variant="outline" className="hidden sm:flex">
                <Plus className="h-4 w-4" />
              </Button>
              <Button onClick={startNewConversation} size="sm" variant="outline" className="sm:hidden">
                <Plus className="h-3 w-3" />
              </Button>
              {selectedConversation && (
                <Button
                  onClick={() => setShowSidebar(false)}
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1 sm:gap-2">
            <Button
              variant={filterBy === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterBy('all')}
              className="text-xs sm:text-sm flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={filterBy === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterBy('unread')}
              className="text-xs sm:text-sm flex-1 sm:flex-none"
            >
              Unread
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 sm:p-4 bg-red-50 border-b">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{error}</span>
              </div>
            </div>
          )}
          
          {filteredConversations.length === 0 ? (
            <div className="text-center py-6 sm:py-8 px-4">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">
                {searchQuery || filterBy !== 'all' ? 
                  'No conversations match your search' : 
                  'No conversations yet'
                }
              </p>
              <Button onClick={startNewConversation} size="sm" className="mt-3 text-xs sm:text-sm">
                Start New Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.participantId}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer hover:bg-gray-50 border-l-4 transition-colors min-h-[72px] sm:min-h-[80px] ${
                    selectedConversation === conversation.participantId
                      ? 'bg-blue-50 border-l-blue-500'
                      : 'border-l-transparent'
                  }`}
                  onClick={() => selectConversation(conversation.participantId)}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                      <AvatarFallback className="bg-gray-100 text-xs sm:text-sm">
                        {conversation.participantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                          {conversation.participantName}
                        </p>
                        <Badge className={`text-xs px-1 py-0 sm:px-1.5 sm:py-0.5 ${getRoleColor(conversation.participantRole)} hidden sm:inline-flex`}>
                          {getRoleDisplayName(conversation.participantRole)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conversation.unreadCount > 0 && (
                          <Badge className="bg-blue-500 text-white text-xs px-1 py-0 sm:px-1.5 sm:py-0.5 min-w-[16px] h-4 sm:h-5 flex items-center justify-center">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    
                    {conversation.projectTitle && (
                      <p className="text-xs text-blue-600 truncate mt-1 hidden sm:block">
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

      {/* Overlay for mobile when sidebar is open */}
      {showSidebar && selectedConversation && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Messages Area */}
      <div className={`
        flex-1 flex flex-col
        ${selectedConversation ? 'block' : 'hidden md:flex'}
        ${showSidebar && selectedConversation ? 'hidden md:flex' : ''}
      `}>
        {selectedConversation && selectedConversationData ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  onClick={goBackToConversations}
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-1 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                  <AvatarFallback className="text-xs sm:text-sm">
                    {selectedConversationData.participantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                      {selectedConversationData.participantName}
                    </h3>
                    <Badge className={`text-xs px-1 py-0 sm:px-1.5 sm:py-0.5 ${getRoleColor(selectedConversationData.participantRole)} hidden sm:inline-flex`}>
                      {getRoleDisplayName(selectedConversationData.participantRole)}
                    </Badge>
                    {selectedConversationData.isOnline && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600 hidden sm:inline">Online</span>
                      </div>
                    )}
                  </div>
                  {selectedConversationData.projectTitle && (
                    <p className="text-xs sm:text-sm text-blue-600 truncate">
                      Project: {selectedConversationData.projectTitle}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-sm sm:text-base">No messages yet. Start the conversation!</p>
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
                        className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-lg ${
                          isFromCurrentUser
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm sm:text-base break-words">{message.content}</p>
                        <div className={`flex items-center justify-between mt-1 sm:mt-2 text-xs ${
                          isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="flex-shrink-0">{formatTime(message.createdAt)}</span>
                          {isFromCurrentUser && (
                            <CheckCircle className="h-3 w-3 ml-2 flex-shrink-0" />
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
            <div className="p-3 sm:p-4 border-t bg-gray-50 flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                  className="flex-1 text-sm sm:text-base"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() || sending}
                  className="px-3 sm:px-4 h-9 sm:h-10"
                  size="sm"
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
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <MessageSquare className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600 text-sm sm:text-base">Choose a conversation from the sidebar to start messaging</p>
              <Button 
                onClick={() => setShowSidebar(true)} 
                className="mt-4 md:hidden"
                variant="outline"
              >
                View Conversations
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}