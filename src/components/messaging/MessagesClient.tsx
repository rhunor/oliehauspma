// src/components/messaging/MessagesClient.tsx - NEW CLIENT COMPONENT
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import MessageCenter from '@/components/messaging/MessageCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Clock } from 'lucide-react';

interface Project {
  _id: string;
  title: string;
  status: string;
}

interface Message {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    name: string;
  };
  project: {
    _id: string;
    title: string;
  };
}

interface MessageStats {
  totalMessages: number;
  unreadMessages: number;
  activeConversations: number;
}

interface MessagesClientProps {
  projects: Project[];
  recentMessages: Message[];
  stats: MessageStats;
}

export default function MessagesClient({ projects, recentMessages, stats }: MessagesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get('project') || (projects.length > 0 ? projects[0]._id : '');
  const selectedProject = projects.find(p => p._id === selectedProjectId);

  const handleProjectSelect = (projectId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('project', projectId);
    router.push(url.pathname + url.search);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">
            Communicate with your project team in real-time.
          </p>
        </div>
      </div>

      {/* Message Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.unreadMessages}</div>
            <p className="text-xs text-muted-foreground">
              Need your attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConversations}</div>
            <p className="text-xs text-muted-foreground">
              Project chats
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Selection and Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <Card>
          <CardHeader>
            <CardTitle>Project Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {projects.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No projects available for messaging
                </div>
              ) : (
                projects.map((project: Project) => (
                  <div
                    key={project._id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedProjectId === project._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleProjectSelect(project._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{project.title}</p>
                        <p className="text-xs text-gray-500 capitalize">{project.status}</p>
                      </div>
                      <div className="h-2 w-2 bg-blue-500 rounded-full" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Center */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <MessageCenter 
              projectId={selectedProject._id}
              projectTitle={selectedProject.title}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Select a project to start messaging
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentMessages.map((message: Message) => (
                <div key={message._id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{message.sender.name}</span>
                      <span className="text-xs text-gray-500">in</span>
                      <span className="text-xs font-medium">{message.project.title}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}