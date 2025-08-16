// src/components/projects/ProjectDetailView.tsx - COMPLETELY FIXED
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar,
  MapPin,
  User,
  Mail,
  Phone,
  DollarSign,
  Clock,
  FileText,
  MessageSquare,
  Edit,
  Download,
  Upload,
  Eye,
  CheckCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  Target,
  Briefcase,
  Settings,
  Video,
  Music,
  Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Complete TypeScript interfaces
interface ProjectFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
  size?: number;
  category?: string;
  tags?: string[];
  description?: string;
  // Additional properties that might exist from database
  mimeType?: string;
  originalName?: string;
  filename?: string;
}

interface ProjectMilestone {
  name: string;
  description?: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ProjectActivity {
  title: string;
  contractor: string;
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  comments?: string;
  images?: string[];
  incidentReport?: string;
  supervisor?: string;
  dependencies?: string[];
  duration?: number;
}

interface ProjectDay {
  date: string;
  dayNumber: number;
  activities: ProjectActivity[];
}

interface ProjectWeek {
  weekNumber: number;
  title: string;
  startDate: string;
  endDate: string;
  days: ProjectDay[];
}

interface ProjectPhase {
  name: string;
  description?: string;
  weeks: ProjectWeek[];
}

interface ProjectSiteSchedule {
  phases: ProjectPhase[];
  totalActivities: number;
  completedActivities: number;
}

interface ProjectUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

interface ProjectData {
  _id: string;
  title: string;
  description: string;
  client: ProjectUser;
  manager: ProjectUser;
  siteAddress: string;
  scopeOfWork?: string;
  designStyle?: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string;
  endDate?: string;
  projectDuration?: string;
  budget?: number;
  progress: number;
  siteSchedule?: ProjectSiteSchedule;
  projectCoordinator?: {
    name: string;
    phone: string;
  };
  siteOfficer?: {
    name: string;
    phone: string;
  };
  workDays?: string;
  files: ProjectFile[];
  milestones: ProjectMilestone[];
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectDetailViewProps {
  project: ProjectData;
  userRole: string;
  userId: string;
}

export default function ProjectDetailView({ project, userRole, userId }: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Helper functions
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string, size: string = 'h-6 w-6') => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className={`${size} text-blue-500`} />;
    } else if (fileType.startsWith('video/')) {
      return <Video className={`${size} text-purple-500`} />;
    } else if (fileType.startsWith('audio/')) {
      return <Music className={`${size} text-green-500`} />;
    } else if (fileType.includes('pdf')) {
      return <FileText className={`${size} text-red-500`} />;
    } else if (fileType.includes('document') || fileType.includes('word')) {
      return <FileText className={`${size} text-blue-600`} />;
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileText className={`${size} text-green-600`} />;
    } else {
      return <FileText className={`${size} text-gray-400`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-yellow-100 text-yellow-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not set';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const canEdit = userRole === 'super_admin' || 
                 (userRole === 'project_manager' && project.manager._id === userId);

  const canUploadFiles = userRole === 'super_admin' || 
                        (userRole === 'project_manager' && project.manager._id === userId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
          <p className="text-gray-600 mt-1">{project.description}</p>
          <div className="flex items-center gap-4 mt-4">
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={getPriorityColor(project.priority)}>
              {project.priority.toUpperCase()} PRIORITY
            </Badge>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{project.progress}% Complete</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${userRole}/messages`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Message Team
            </Link>
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">Project Progress</span>
            <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-3" />
          {project.siteSchedule && (
            <p className="text-xs text-gray-500 mt-2">
              {project.siteSchedule.completedActivities} of {project.siteSchedule.totalActivities} activities completed
            </p>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Project Details */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Site Address</label>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{project.siteAddress}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Duration</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{project.projectDuration || 'Not specified'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Start Date</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{formatDate(project.startDate)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">End Date</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{formatDate(project.endDate)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {project.scopeOfWork && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Scope of Work</label>
                      <p className="text-sm mt-1">{project.scopeOfWork}</p>
                    </div>
                  )}
                  
                  {project.designStyle && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Design Style</label>
                      <p className="text-sm mt-1">{project.designStyle}</p>
                    </div>
                  )}
                  
                  {project.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notes</label>
                      <p className="text-sm mt-1">{project.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tags */}
              {project.tags && project.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Budget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Budget
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(project.budget)}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Files</span>
                    <span className="font-medium">{project.files?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Milestones</span>
                    <span className="font-medium">{project.milestones?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Work Days</span>
                    <span className="font-medium text-xs">{project.workDays || 'Mon-Sat'}</span>
                  </div>
                  {project.siteSchedule && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Activities</span>
                      <span className="font-medium">
                        {project.siteSchedule.completedActivities}/{project.siteSchedule.totalActivities}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Project Coordinator */}
              {project.projectCoordinator && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Project Coordinator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">{project.projectCoordinator.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      {project.projectCoordinator.phone}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Site Officer */}
              {project.siteOfficer && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Site Officer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">{project.siteOfficer.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      {project.siteOfficer.phone}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {project.client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{project.client.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${project.client.email}`} className="hover:text-blue-600">
                        {project.client.email}
                      </a>
                    </div>
                    {project.client.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${project.client.phone}`} className="hover:text-blue-600">
                          {project.client.phone}
                        </a>
                      </div>
                    )}
                    <Badge className="mt-2 bg-green-100 text-green-800">Client</Badge>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/${userRole}/messages`}>
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Project Manager */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Project Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {project.manager.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{project.manager.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${project.manager.email}`} className="hover:text-blue-600">
                        {project.manager.email}
                      </a>
                    </div>
                    {project.manager.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${project.manager.phone}`} className="hover:text-blue-600">
                          {project.manager.phone}
                        </a>
                      </div>
                    )}
                    <Badge className="mt-2 bg-blue-100 text-blue-800">Manager</Badge>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/${userRole}/messages`}>
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          {project.siteSchedule && project.siteSchedule.phases ? (
            <div className="space-y-6">
              {project.siteSchedule.phases.map((phase, phaseIndex) => (
                <Card key={phaseIndex}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      {phase.name}
                    </CardTitle>
                    {phase.description && (
                      <p className="text-sm text-gray-600">{phase.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {phase.weeks && phase.weeks.length > 0 ? (
                      <div className="space-y-4">
                        {phase.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Week {week.weekNumber}: {week.title}</h4>
                              <span className="text-sm text-gray-500">
                                {formatDate(week.startDate)} - {formatDate(week.endDate)}
                              </span>
                            </div>
                            {week.days && week.days.length > 0 ? (
                              <div className="space-y-3">
                                {week.days.map((day, dayIndex) => (
                                  <div key={dayIndex} className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="font-medium mb-2">
                                      Day {day.dayNumber} - {formatDate(day.date)}
                                    </h5>
                                    {day.activities && day.activities.length > 0 ? (
                                      <div className="space-y-2">
                                        {day.activities.map((activity, activityIndex) => (
                                          <div key={activityIndex} className="flex items-center justify-between bg-white rounded p-2">
                                            <div className="flex-1">
                                              <p className="font-medium text-sm">{activity.title}</p>
                                              <p className="text-xs text-gray-600">Contractor: {activity.contractor}</p>
                                              {activity.supervisor && (
                                                <p className="text-xs text-gray-600">Supervisor: {activity.supervisor}</p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Badge className={`text-xs ${
                                                activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                activity.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                activity.status === 'delayed' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                              }`}>
                                                {activity.status.replace('_', ' ')}
                                              </Badge>
                                              {activity.status === 'completed' && (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                              )}
                                              {activity.status === 'delayed' && (
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500">No activities scheduled</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No days scheduled</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No weeks scheduled for this phase</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Available</h3>
                <p className="text-gray-600">The project schedule has not been created yet.</p>
                {canEdit && (
                  <Button className="mt-4" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Files Tab - COMPLETELY FIXED */}
        <TabsContent value="files" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Project Files</h3>
            {canUploadFiles && (
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            )}
          </div>
          
          {project.files && project.files.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.files.map((file, index) => {
                // CRITICAL FIX: Comprehensive defensive checks with proper typing
                const fileType = file.type || file.mimeType || 'application/octet-stream';
                const fileName = file.name || file.originalName || file.filename || `File ${index + 1}`;
                const fileUrl = file.url || '';
                const fileSize = file.size || 0;
                const uploadDate = file.uploadedAt || '';
                
                return (
                  <Card key={`${index}-${fileName}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {/* CRITICAL FIX: Safe file type checking with fallbacks */}
                          {fileType && fileType.startsWith('image/') && fileUrl ? (
                            <div className="relative w-12 h-12">
                              <Image
                                src={fileUrl}
                                alt={fileName}
                                fill
                                className="object-cover rounded"
                                onError={(e) => {
                                  // Fallback for broken images
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">${getFileIcon(fileType, 'h-6 w-6')}</div>`;
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                              {getFileIcon(fileType)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={fileName}>
                            {fileName}
                          </p>
                          {uploadDate && (
                            <p className="text-xs text-gray-500">
                              Uploaded {formatDate(uploadDate)}
                            </p>
                          )}
                          {fileSize > 0 && (
                            <p className="text-xs text-gray-500">
                              {formatFileSize(fileSize)}
                            </p>
                          )}
                          {file.category && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {file.category}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {fileUrl && (
                              <>
                                <Button size="sm" variant="outline" asChild>
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </a>
                                </Button>
                                <Button size="sm" variant="outline" asChild>
                                  <a href={fileUrl} download={fileName}>
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Yet</h3>
                <p className="text-gray-600">Project files will appear here once uploaded.</p>
                {canUploadFiles && (
                  <Button className="mt-4" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload First File
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Project Milestones</h3>
            {canEdit && (
              <Button variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            )}
          </div>

          {project.milestones && project.milestones.length > 0 ? (
            <div className="space-y-4">
              {project.milestones.map((milestone, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{milestone.name}</h4>
                          <Badge className={getMilestoneStatusColor(milestone.status)}>
                            {milestone.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {formatDate(milestone.dueDate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {milestone.status === 'completed' && (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        )}
                        {milestone.status === 'in_progress' && (
                          <Clock className="h-6 w-6 text-blue-500" />
                        )}
                        {milestone.status === 'pending' && (
                          <AlertCircle className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Milestones Set</h3>
                <p className="text-gray-600">Project milestones help track important achievements.</p>
                {canEdit && (
                  <Button className="mt-4" variant="outline">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create First Milestone
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}