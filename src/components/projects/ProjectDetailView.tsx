// FILE: src/components/projects/ProjectDetailView.tsx - COMPLETE WITH MULTIPLE MANAGERS
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
  Image as ImageIcon,
  Plus
} from 'lucide-react';
import Link from 'next/link';

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
  managers: ProjectUser[]; // ✅ CHANGED: Multiple managers
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

  const getFileIcon = (fileType: string, size: string = 'h-4 w-4 sm:h-6 sm:w-6') => {
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

  // ✅ UPDATED: Check if user is any of the managers
  const isProjectManager = project.managers?.some(manager => manager._id === userId);
  
  const canEdit = userRole === 'super_admin' || 
                 (userRole === 'project_manager' && isProjectManager);

  const canUploadFiles = userRole === 'super_admin' || 
                        (userRole === 'project_manager' && isProjectManager);

  const getRoleBasePath = () => {
    switch (userRole) {
      case 'super_admin': return '/admin';
      case 'project_manager': return '/manager'; 
      case 'client': return '/client';
      default: return '/dashboard';
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">{project.title}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 line-clamp-3">{project.description}</p>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={getPriorityColor(project.priority)}>
              {project.priority.toUpperCase()} PRIORITY
            </Badge>
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-600">{project.progress}% Complete</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:flex-shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto text-xs sm:text-sm">
              <Link href={`${getRoleBasePath()}/projects/${project._id}/edit`}>
                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Edit Project</span>
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto text-xs sm:text-sm">
            <Link href={`${getRoleBasePath()}/messages`}>
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="sm:hidden truncate">Message</span>
              <span className="hidden sm:inline truncate">Message Team</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">Project Progress</span>
            <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2 sm:h-3" />
          {project.siteSchedule && (
            <p className="text-xs text-gray-500 mt-2">
              {project.siteSchedule.completedActivities} of {project.siteSchedule.totalActivities} activities completed
            </p>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 py-2">Overview</TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs sm:text-sm px-2 py-2">Schedule</TabsTrigger>
              <TabsTrigger value="files" className="text-xs sm:text-sm px-2 py-2">Files</TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs sm:text-sm px-2 py-2">Milestones</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Site Address:</span>
                      <p className="text-gray-900 mt-1 break-words">{project.siteAddress}</p>
                    </div>
                    {project.scopeOfWork && (
                      <div>
                        <span className="font-medium text-gray-600">Scope of Work:</span>
                        <p className="text-gray-900 mt-1">{project.scopeOfWork}</p>
                      </div>
                    )}
                    {project.designStyle && (
                      <div>
                        <span className="font-medium text-gray-600">Design Style:</span>
                        <p className="text-gray-900 mt-1">{project.designStyle}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-600">Project Duration:</span>
                      <p className="text-gray-900 mt-1">{project.projectDuration || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Work Days:</span>
                      <p className="text-gray-900 mt-1">{project.workDays || 'Mon-Sat'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Start Date:</span>
                      <p className="text-gray-900 mt-1">{formatDate(project.startDate)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">End Date:</span>
                      <p className="text-gray-900 mt-1">{formatDate(project.endDate)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Budget:</span>
                      <p className="text-gray-900 mt-1">{formatCurrency(project.budget)}</p>
                    </div>
                  </div>
                  
                  {project.notes && (
                    <div className="pt-3 sm:pt-4 border-t">
                      <span className="font-medium text-gray-600">Additional Notes:</span>
                      <p className="text-gray-900 mt-1 whitespace-pre-wrap text-sm">{project.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              {project.siteSchedule && project.siteSchedule.phases.length > 0 ? (
                <div className="space-y-4">
                  {project.siteSchedule.phases.map((phase, phaseIndex) => (
                    <Card key={phaseIndex}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                          {phase.name}
                        </CardTitle>
                        {phase.description && (
                          <p className="text-sm text-gray-600">{phase.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        {phase.weeks && phase.weeks.length > 0 ? (
                          <div className="space-y-3">
                            {phase.weeks.map((week, weekIndex) => (
                              <div key={weekIndex} className="border rounded-lg p-3 sm:p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                  <h4 className="font-medium text-sm sm:text-base">{week.title}</h4>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {formatDate(week.startDate)} - {formatDate(week.endDate)}
                                  </div>
                                </div>
                                {week.days && week.days.length > 0 ? (
                                  <div className="space-y-2">
                                    {week.days.map((day, dayIndex) => (
                                      <div key={dayIndex} className="bg-gray-50 rounded p-2 sm:p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-medium text-xs sm:text-sm">
                                            Day {day.dayNumber} - {formatDate(day.date)}
                                          </span>
                                        </div>
                                        {day.activities && day.activities.length > 0 ? (
                                          <div className="space-y-1">
                                            {day.activities.map((activity, activityIndex) => (
                                              <div key={activityIndex} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                                <span className="font-medium">{activity.title}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-gray-500">{activity.contractor}</span>
                                                  <Badge className={`text-xs ${
                                                    activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    activity.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                    activity.status === 'delayed' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                  }`}>
                                                    {activity.status.replace('_', ' ')}
                                                  </Badge>
                                                  {activity.status === 'completed' && (
                                                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                                                  )}
                                                  {activity.status === 'delayed' && (
                                                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-gray-500">No activities scheduled</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500">No days scheduled</p>
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
                  <CardContent className="p-8 sm:p-12 text-center">
                    <CalendarIcon className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Schedule Available</h3>
                    <p className="text-sm text-gray-600 mb-4">The project schedule has not been created yet.</p>
                    {canEdit && (
                      <Button className="w-full sm:w-auto" variant="outline" asChild>
                        <Link href={`${getRoleBasePath()}/projects/${project._id}/schedule`}>
                          <Settings className="h-4 w-4 mr-2" />
                          Create Schedule
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base sm:text-lg font-semibold">Project Files</h3>
                {canUploadFiles && (
                  <Button className="w-full sm:w-auto">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                )}
              </div>
              
              {project.files && project.files.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                  {project.files.map((file, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">
                              {file.name || file.originalName || 'Unnamed file'}
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1 text-xs text-gray-500">
                              <span>{file.size ? formatFileSize(file.size) : 'Unknown size'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>Uploaded {formatDate(file.uploadedAt)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">By: {file.uploadedBy}</p>
                            {file.description && (
                              <p className="text-xs text-gray-600 mt-2 line-clamp-2">{file.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0">
                            <Button variant="outline" size="sm" asChild>
                              <a href={file.url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={file.url} download={file.name}>
                                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Files Yet</h3>
                    <p className="text-sm text-gray-600 mb-4">Project files will appear here once uploaded.</p>
                    {canUploadFiles && (
                      <Button className="w-full sm:w-auto" variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload First File
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Milestones Tab */}
            <TabsContent value="milestones" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base sm:text-lg font-semibold">Project Milestones</h3>
                {canEdit && (
                  <Button variant="outline" className="w-full sm:w-auto" asChild>
                    <Link href={`${getRoleBasePath()}/projects/${project._id}/milestones`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Add Milestone
                    </Link>
                  </Button>
                )}
              </div>

              {project.milestones && project.milestones.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {project.milestones.map((milestone, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                              <h4 className="font-semibold text-sm sm:text-base">{milestone.name}</h4>
                              <Badge className={getMilestoneStatusColor(milestone.status)}>
                                {milestone.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            {milestone.description && (
                              <p className="text-xs sm:text-sm text-gray-600 mb-2">{milestone.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>Due: {formatDate(milestone.dueDate)}</span>
                            </div>
                          </div>
                          <div className="flex items-center flex-shrink-0">
                            {milestone.status === 'completed' && (
                              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                            )}
                            {milestone.status === 'in_progress' && (
                              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                            )}
                            {milestone.status === 'pending' && (
                              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <Target className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Milestones Set</h3>
                    <p className="text-sm text-gray-600 mb-4">Project milestones help track important achievements.</p>
                    {canEdit && (
                      <Button className="w-full sm:w-auto" variant="outline" asChild>
                        <Link href={`${getRoleBasePath()}/projects/${project._id}/milestones`}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Create First Milestone
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                  <AvatarFallback className="text-xs sm:text-sm">
                    {project.client.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base truncate">{project.client.name}</p>
                  <p className="text-xs sm:text-sm text-gray-500 capitalize">{project.client.role}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">{project.client.email}</span>
                </div>
                {project.client.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{project.client.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ✅ UPDATED: Project Managers - Multiple */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
                Project {project.managers && project.managers.length > 1 ? 'Managers' : 'Manager'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.managers && project.managers.length > 0 ? (
                project.managers.map((manager) => (
                  <div key={manager._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs sm:text-sm">
                          {manager.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{manager.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500 capitalize">{manager.role}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">{manager.email}</span>
                      </div>
                      {manager.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>{manager.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No managers assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Budget Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                Budget Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Total Budget</span>
                <span className="font-medium text-sm sm:text-base">{formatCurrency(project.budget)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Files</span>
                <span className="font-medium text-sm">{project.files?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Milestones</span>
                <span className="font-medium text-sm">{project.milestones?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Managers</span>
                <span className="font-medium text-sm">{project.managers?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Work Days</span>
                <span className="font-medium text-xs">{project.workDays || 'Mon-Sat'}</span>
              </div>
              {project.siteSchedule && (
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-500">Activities</span>
                  <span className="font-medium text-sm">
                    {project.siteSchedule.completedActivities}/{project.siteSchedule.totalActivities}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Coordinator */}
          {project.projectCoordinator && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  Project Coordinator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm sm:text-base">{project.projectCoordinator.name}</p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                  {project.projectCoordinator.phone}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Site Officer */}
          {project.siteOfficer && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  Site Officer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm sm:text-base">{project.siteOfficer.name}</p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                  {project.siteOfficer.phone}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}