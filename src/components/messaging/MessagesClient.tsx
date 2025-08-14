// src/components/messaging/MessagesClient.tsx - FIXED ALL BUILD ERRORS
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Search, 
  Users, 
  CheckCircle, 
  Paperclip,
  Phone,
  Video,
  MoreVertical,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/utils';

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
    role: string;
  };
  recipient: {
    _id: string;
    name: string;
    role: string;
  };
  project?: {
    _id: string;
    title: string;
  };
  createdAt: string;
  isRead: boolean;
  messageType: 'text' | 'file' | 'system';
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
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

export default function MessagesClient({ userId, userRole }: MessagesClientProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/conversations');
      if (response.ok) {
        const responseData = await response.json();
        setConversations(responseData.conversations || []);
      } else {
        throw new Error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load conversations",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMessages = useCallback(async (participantId: string) => {
    if (!participantId) return;
    
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/messages?participantId=${participantId}`);
      if (response.ok) {
        const responseData = await response.json();
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
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load messages",
      });
    } finally {
      setMessagesLoading(false);
    }
  }, [toast]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: newMessage.trim(),
          messageType: 'text'
        })
      });

      if (response.ok) {
        setNewMessage('');
        await fetchMessages(selectedConversation);
        await fetchConversations(); // Refresh to update last message
        toast({
          title: "Message sent",
          description: "Your message has been delivered",
        });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async () => {
    try {
      // Fetch available users based on role
      const endpoint = userRole === 'project_manager' 
        ? '/api/users?role=client' 
        : '/api/users?role=project_manager';
      
      const response = await fetch(endpoint);
      if (response.ok) {
        // For now, we'll show a simple prompt for user ID
        // In a real app, you'd show a user selection modal
        const recipientId = prompt('Enter user ID to start conversation:');
        if (recipientId) {
          setSelectedConversation(recipientId);
          await fetchMessages(recipientId);
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start conversation",
      });
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation, fetchMessages]);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = searchQuery === '' || 
      conv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.projectTitle && conv.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'unread' && conv.unreadCount > 0) ||
      (filterBy === 'clients' && conv.participantRole === 'client') ||
      (filterBy === 'managers' && conv.participantRole === 'project_manager') ||
      (filterBy === 'admins' && conv.participantRole === 'super_admin');
    
    return matchesSearch && matchesFilter;
  });

  const selectedConversationData = conversations.find(c => c.participantId === selectedConversation);
  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'project_manager' ? 'Communicate with your clients and team' : 'Communicate with your project manager'}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MessageSquare className="h-4 w-4" />
            {totalUnread > 0 ? (
              <span>{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</span>
            ) : (
              <span>All caught up</span>
            )}
          </div>
          <Button onClick={startNewConversation} size="sm">
            <Users className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Messages Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversations</CardTitle>
            
            {/* Search and Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conversations</SelectItem>
                  <SelectItem value="unread">Unread Messages</SelectItem>
                  {userRole === 'project_manager' && (
                    <SelectItem value="clients">Clients Only</SelectItem>
                  )}
                  {userRole === 'client' && (
                    <SelectItem value="managers">Managers Only</SelectItem>
                  )}
                  <SelectItem value="admins">Admins Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-0">
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
                        ? 'bg-blue-50 border-blue-500'
                        : 'border-transparent'
                    }`}
                    onClick={() => setSelectedConversation(conversation.participantId)}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      {conversation.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conversation.participantName}
                        </p>
                        <div className="flex items-center gap-1">
                          {conversation.unreadCount > 0 && (
                            <Badge variant="default" className="text-xs px-1.5 py-0.5">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(new Date(conversation.lastMessageTime))}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.lastMessage || 'No messages yet'}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {conversation.participantRole.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {conversation.projectTitle && (
                        <p className="text-xs text-blue-600 truncate mt-1">
                          📁 {conversation.projectTitle}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Message Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      {selectedConversationData?.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {selectedConversationData?.participantName || 'Unknown User'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedConversationData?.participantRole?.replace('_', ' ') || 'User'}
                        </Badge>
                        {selectedConversationData?.isOnline ? (
                          <span className="text-xs text-green-600">● Online</span>
                        ) : (
                          <span className="text-xs text-gray-500">● Offline</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {selectedConversationData?.projectTitle && (
                  <div className="bg-blue-50 p-2 rounded-lg mt-3">
                    <p className="text-sm text-blue-800">
                      📁 Project: {selectedConversationData.projectTitle}
                    </p>
                  </div>
                )}
              </CardHeader>

              {/* Messages List */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No messages yet</p>
                    <p className="text-gray-500 text-sm mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const isOwn = message.sender._id === userId;
                      const showAvatar = index === 0 || messages[index - 1].sender._id !== message.sender._id;
                      
                      return (
                        <div
                          key={message._id}
                          className={`flex gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isOwn && showAvatar && (
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                          {!isOwn && !showAvatar && (
                            <div className="w-8"></div>
                          )}
                          
                          <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-1' : ''}`}>
                            {showAvatar && (
                              <div className={`text-xs text-gray-500 mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                                {message.sender.name}
                              </div>
                            )}
                            
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                isOwn
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {message.attachments.map((attachment, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <Paperclip className="h-3 w-3" />
                                      <a 
                                        href={attachment.url} 
                                        className="underline hover:no-underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {attachment.filename}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <div className={`flex items-center gap-1 mt-1 text-xs ${
                              isOwn 
                                ? 'text-blue-100 justify-end' 
                                : 'text-gray-500 justify-start'
                            }`}>
                              <span>{formatTimeAgo(new Date(message.createdAt))}</span>
                              {isOwn && (
                                <CheckCircle className={`h-3 w-3 ${
                                  message.isRead ? 'text-blue-200' : 'text-blue-400'
                                }`} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message ${selectedConversationData?.participantName || 'user'}...`}
                    className="flex-1 min-h-[60px] max-h-[120px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-3"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="px-3" disabled>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-600 mb-4">Choose someone to start messaging</p>
                {conversations.length === 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">
                      {userRole === 'project_manager' 
                        ? 'Your clients will appear here once you start a conversation with them.'
                        : 'Your project manager will appear here once they send you a message.'
                      }
                    </p>
                    <Button onClick={startNewConversation} size="sm">
                      Start New Conversation
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}