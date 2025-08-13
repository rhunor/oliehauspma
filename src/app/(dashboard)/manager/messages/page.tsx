// src/app/(dashboard)/manager/messages/page.tsx - MANAGER MESSAGES
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  MessageSquare, 
  Send, 
  Search, 
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTimeAgo } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  projectId?: string;
  project?: {
    title: string;
  };
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  participantId: string;
  participantName: string;
  participantRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  projectTitle?: string;
}

export default function ManagerMessagesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<string>('all');

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.data || []);
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
  }, [toast]); // ✅ Added toast dependency

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]); // ✅ Now includes fetchConversations dependency

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const fetchMessages = async (participantId: string) => {
    try {
      const response = await fetch(`/api/messages?participantId=${participantId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
        
        // Mark messages as read
        await fetch('/api/messages/mark-read', {
          method: 'PATCH',
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
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: newMessage.trim()
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

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = searchQuery === '' || 
      conv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.projectTitle && conv.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'unread' && conv.unreadCount > 0) ||
      (filterBy === 'clients' && conv.participantRole === 'client') ||
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
          <p className="text-gray-600 mt-1">Communicate with your clients and team</p>
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
                  <SelectItem value="clients">Clients Only</SelectItem>
                  <SelectItem value="admins">Admins Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">
                  {searchQuery || filterBy !== 'all' ? 'No conversations match your filters' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.participantId}
                    onClick={() => setSelectedConversation(conversation.participantId)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                      selectedConversation === conversation.participantId
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{conversation.participantName}</span>
                        <Badge variant="outline" className="text-xs">
                          {conversation.participantRole.replace('_', ' ')}
                        </Badge>
                      </div>
                      {conversation.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                    
                    {conversation.projectTitle && (
                      <p className="text-xs text-blue-600 mb-1">{conversation.projectTitle}</p>
                    )}
                    
                    <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                      {conversation.lastMessage}
                    </p>
                    
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(new Date(conversation.lastMessageTime))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedConversationData?.participantName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {selectedConversationData?.participantRole.replace('_', ' ')}
                      </Badge>
                      {selectedConversationData?.projectTitle && (
                        <span className="text-sm text-gray-600">
                          Project: {selectedConversationData.projectTitle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${
                        message.sender._id === session?.user?.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.sender._id === session?.user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className={`text-xs ${
                            message.sender._id === session?.user?.id
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}>
                            {formatTimeAgo(new Date(message.createdAt))}
                          </p>
                          {message.sender._id === session?.user?.id && (
                            <CheckCircle className={`h-3 w-3 ${
                              message.isRead ? 'text-blue-200' : 'text-blue-400'
                            }`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[60px] max-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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
                <p className="text-gray-600">Choose a conversation from the left to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}