"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  FolderOpen, 
  CheckSquare, 
  MessageSquare,
  FileText,
  Download,
  Eye,
  Clock,
  User,
  Phone,
  Mail,
  Bot
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTimeAgo } from "@/lib/utils";

// Mock data for client view
const mockClientProjects = [
  {
    id: "1",
    title: "My Dream Home Interior",
    description: "Complete interior design and renovation for our new 4-bedroom home in Lekki Phase 1",
    status: "in_progress",
    progress: 75,
    priority: "high",
    manager: "John Doe",
    managerPhone: "+234-801-234-5678",
    managerEmail: "john@olivehaus.com",
    startDate: "2024-10-01",
    dueDate: "2024-12-15",
    budget: 2500000,
    tasksCompleted: 18,
    totalTasks: 24,
    nextMilestone: "Living Room Installation",
    milestoneDue: "2024-12-10",
  },
];

const mockProjectFiles = [
  {
    id: "1",
    name: "Living Room Design Concepts.pdf",
    size: "2.4 MB",
    type: "application/pdf",
    uploadedAt: "2024-11-28",
    category: "design",
  },
  {
    id: "2",
    name: "Kitchen Layout Final.jpg",
    size: "1.8 MB",
    type: "image/jpeg",
    uploadedAt: "2024-11-25",
    category: "design",
  },
  {
    id: "3",
    name: "Progress Photos - Week 8.zip",
    size: "12.3 MB",
    type: "application/zip",
    uploadedAt: "2024-11-20",
    category: "progress",
  },
];

const mockProjectUpdates = [
  {
    id: "1",
    title: "Kitchen Cabinets Installed",
    message: "All kitchen cabinets have been successfully installed. Moving on to countertop installation next.",
    date: "2024-12-01",
    images: ["kitchen-1.jpg", "kitchen-2.jpg"],
  },
  {
    id: "2",
    title: "Living Room Painting Complete",
    message: "The living room walls have been painted with the selected colors. The result looks amazing!",
    date: "2024-11-28",
    images: ["living-room.jpg"],
  },
  {
    id: "3",
    title: "Furniture Delivery Scheduled",
    message: "Your selected furniture pieces will be delivered on December 5th. Please ensure someone is available to receive them.",
    date: "2024-11-25",
    images: [],
  },
];

const mockMessages = [
  {
    id: "1",
    from: "John Doe",
    message: "Hi Mrs. Adebayo! The kitchen cabinets look great. Would you like to schedule a walkthrough this week?",
    timestamp: new Date("2024-12-01T14:30:00"),
    isRead: false,
  },
  {
    id: "2",
    from: "John Doe",
    message: "I've uploaded the latest progress photos. Please take a look and let me know your thoughts.",
    timestamp: new Date("2024-11-30T10:15:00"),
    isRead: true,
  },
  {
    id: "3",
    from: "You",
    message: "Thank you for the update! The kitchen looks wonderful. When will the countertops be installed?",
    timestamp: new Date("2024-11-29T16:45:00"),
    isRead: true,
  },
];

export default function ClientDashboard() {
  const { data: session } = useSession();
  const projects = mockClientProjects;
  const files = mockProjectFiles;
  const updates = mockProjectUpdates;
  const messages = mockMessages;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const project = projects[0];
  const unreadMessages = messages.filter(msg => !msg.isRead && msg.from !== "You").length;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-neutral-600 mt-1">
            Track your project progress and stay connected with your design team.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Message Designer
            {unreadMessages > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 text-xs">
                {unreadMessages}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {project && (
        <Card variant="elegant" className="border-2 border-primary-200">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-serif text-gray-900">
                  {project.title}
                </CardTitle>
                <p className="text-neutral-600 mt-1">{project.description}</p>
              </div>
              <StatusBadge status={project.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Progress</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-neutral-200 rounded-full h-3">
                    <div
                      className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {project.tasksCompleted} of {project.totalTasks} tasks completed
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                <div className="space-y-1">
                  <p className="text-sm text-neutral-600">
                    <strong>Started:</strong> {formatDate(project.startDate)}
                  </p>
                  <p className="text-sm text-neutral-600">
                    <strong>Due:</strong> {formatDate(project.dueDate)}
                  </p>
                  <p className="text-sm text-primary-600">
                    <strong>Next Milestone:</strong> {project.nextMilestone}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Your Designer</h4>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{project.manager}</p>
                    <p className="text-xs text-neutral-500">Project Manager</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <Phone className="h-3 w-3" />
                    {project.managerPhone}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <Mail className="h-3 w-3" />
                    {project.managerEmail}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Project Progress"
          value={`${project?.progress || 0}%`}
          description="Overall completion"
          icon={<CheckSquare className="h-6 w-6" />}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Tasks Completed"
          value={`${project?.tasksCompleted || 0}/${project?.totalTasks || 0}`}
          description="Project milestones"
          icon={<FolderOpen className="h-6 w-6" />}
        />
        <StatsCard
          title="New Messages"
          value={unreadMessages}
          description="From your designer"
          icon={<MessageSquare className="h-6 w-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card variant="elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              Recent Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {updates.map((update) => (
              <div key={update.id} className="border-l-4 border-primary-500 pl-4 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{update.title}</h4>
                  <span className="text-xs text-neutral-500">{formatDate(update.date)}</span>
                </div>
                <p className="text-sm text-neutral-600 mb-2">{update.message}</p>
                {update.images.length > 0 && (
                  <div className="flex gap-2">
                    {update.images.map((image, index) => (
                      <div key={index} className="w-16 h-16 bg-neutral-200 rounded-lg flex items-center justify-center">
                        <Eye className="h-4 w-4 text-neutral-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-600" />
              Project Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg hover:border-primary-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{file.size}</span>
                      <span>•</span>
                      <span>{formatDate(file.uploadedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-4">
              <FileText className="h-4 w-4 mr-2" />
              View All Files
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card variant="elegant">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Recent Messages
          </CardTitle>
          <Button variant="outline" size="sm">
            View All Messages
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.slice(0, 3).map((message) => (
            <div key={message.id} className={`flex gap-3 p-3 rounded-lg ${
              message.from === "You" ? "bg-primary-50 ml-8" : "bg-neutral-50 mr-8"
            }`}>
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {message.from === "You" ? "Y" : message.from.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-gray-900">{message.from}</p>
                  <span className="text-xs text-neutral-500">
                    {formatTimeAgo(message.timestamp)}
                  </span>
                  {!message.isRead && message.from !== "You" && (
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  )}
                </div>
                <p className="text-sm text-neutral-700">{message.message}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card variant="gradient" className="border-2 border-secondary-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-500 rounded-full flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-gray-900">AI Assistant</h3>
                <p className="text-neutral-600">Get instant answers about your project</p>
              </div>
            </div>
            <Button className="bg-secondary-500 hover:bg-secondary-600">
              <MessageSquare className="h-4 w-4 mr-2" />
              Start Chat
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="ghost" size="sm" className="text-left justify-start">
              &quot;What&apos;s my project status?&quot;
            </Button>
            <Button variant="ghost" size="sm" className="text-left justify-start">
              &quot;When is the next milestone?&quot;
            </Button>
            <Button variant="ghost" size="sm" className="text-left justify-start">
              &quot;Show me recent updates&quot;
            </Button>
            <Button variant="ghost" size="sm" className="text-left justify-start">
              &quot;Contact my designer&quot;
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}