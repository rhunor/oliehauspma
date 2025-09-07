// src/app/(dashboard)/client/page.tsx - PROPERLY CORRECTED: Follows original project structure
import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, 
  Calendar, 
  Target, 
  ChevronRight, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  FileText,
 
  MessageSquare,
 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

// Helper function to format time from date string (proper TypeScript)
function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid time';
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid time';
  }
}

// Proper TypeScript interfaces following project patterns
interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  recentMessages: number;
  totalFiles: number;
  totalIncidents: number;
  activeRisks: number;
}

interface MilestoneProgress {
  currentPhase: number;
  totalPhases: number;
  completedMilestones: Array<{
    _id: string;
    projectId: string;
    phase: string;
    title: string;
    description: string;
    status: string;
    completedDate?: string;
    completedBy?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  nextMilestone?: {
    _id: string;
    projectId: string;
    phase: string;
    title: string;
    description: string;
    status: string;
    completedDate?: string;
    completedBy?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  };
  overallProgress: number;
}

interface ActiveProject {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  milestoneProgress: MilestoneProgress;
}

interface RecentUpdate {
  _id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  projectTitle?: string;
}

interface RecentFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  category: string;
  projectTitle: string;
  uploadedBy: {
    name: string;
  };
  createdAt: string;
}

interface WorkScheduleItem {
  _id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  startDate: string;
  contractor?: string;
  projectTitle: string;
}

interface WorkScheduleWidget {
  todayTasks: WorkScheduleItem[];
  upcomingTasks: WorkScheduleItem[];
  totalTasks: number;
  completedToday: number;
}

interface DashboardData {
  stats: ClientStats;
  activeProject: ActiveProject | null;
  recentUpdates: RecentUpdate[];
  recentFiles: RecentFile[];
  completedTasks: WorkScheduleItem[];
  workSchedule: WorkScheduleWidget;
  recentIncidents: Array<{
    _id: string;
    title: string;
    severity: string;
    status: string;
    reportedDate: string;
    projectTitle: string;
  }>;
  activeRisks: Array<{
    _id: string;
    title: string;
    severity: string;
    status: string;
    likelihood: string;
    impact: string;
    projectTitle: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

// MongoDB document interfaces (proper typing)
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  client: ObjectId;
  manager: ObjectId;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface MilestoneDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  phase: 'construction' | 'installation' | 'styling';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedDate?: Date;
  completedBy?: ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mobile App Style Dashboard Card Component (NEW - for mobile only)
interface MobileDashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink';
  stats?: {
    value: number | string;
    label: string;
  };
  subtitle?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}

function MobileDashboardCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  stats,
  subtitle,
  isEmpty = false,
  emptyMessage 
}: MobileDashboardCardProps) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { 
      bg: 'bg-blue-50 hover:bg-blue-100', 
      icon: 'text-blue-600', 
      text: 'text-blue-700' 
    },
    green: { 
      bg: 'bg-green-50 hover:bg-green-100', 
      icon: 'text-green-600', 
      text: 'text-green-700' 
    },
    purple: { 
      bg: 'bg-purple-50 hover:bg-purple-100', 
      icon: 'text-purple-600', 
      text: 'text-purple-700' 
    },
    orange: { 
      bg: 'bg-orange-50 hover:bg-orange-100', 
      icon: 'text-orange-600', 
      text: 'text-orange-700' 
    },
    red: { 
      bg: 'bg-red-50 hover:bg-red-100', 
      icon: 'text-red-600', 
      text: 'text-red-700' 
    },
    pink: { 
      bg: 'bg-pink-50 hover:bg-pink-100', 
      icon: 'text-pink-600', 
      text: 'text-pink-700' 
    }
  };

  const colors = colorClasses[color];

  return (
    <Link href={href}>
      <Card className={`${colors.bg} border-0 hover:shadow-md transition-all duration-200 cursor-pointer group h-full lg:hidden`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-full bg-white shadow-sm`}>
                <Icon className={`h-8 w-8 ${colors.icon}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-bold text-lg ${colors.text}`}>{title}</h3>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isEmpty ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <Icon className="h-12 w-12 mx-auto opacity-50" />
                </div>
                <p className="text-gray-500 text-sm font-medium">{emptyMessage}</p>
              </div>
            ) : (
              <>
                {stats && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl font-bold ${colors.text}`}>{stats.value}</p>
                      <p className="text-sm text-gray-600">{stats.label}</p>
                    </div>
                  </div>
                )}
                
                <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Original Dashboard Card Component (preserved for desktop)
interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  stats?: {
    value: number;
    label: string;
  };
}

function DashboardCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  stats 
}: DashboardCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    red: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
  };

  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full hidden lg:block">
        <CardContent className="p-0">
          <div className={`bg-gradient-to-br ${colorClasses[color]} p-6 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-20">
              <Icon className="h-24 w-24 transform rotate-12" />
            </div>
            <div className="relative">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  {stats && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-2xl font-bold">{stats.value}</span>
                      <span className="text-sm opacity-90">{stats.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                View Details
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Work Schedule Widget Component (preserved)
function WorkScheduleWidget({ 
  workSchedule, 
  className = "" 
}: { 
  workSchedule: WorkScheduleWidget;
  className?: string;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';  
      case 'delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <Card className={`w-full max-w-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Today&apos;s Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-medium">
            {workSchedule.completedToday}/{workSchedule.totalTasks}
          </span>
        </div>
        
        <Progress 
          value={workSchedule.totalTasks > 0 ? (workSchedule.completedToday / workSchedule.totalTasks) * 100 : 0} 
          className="h-2"
        />

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {workSchedule.todayTasks.slice(0, 3).map((task) => (
            <div key={task._id} className="flex items-center justify-between py-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {task.contractor || 'Unassigned'}
                  </span>
                </div>
              </div>
              <div className="text-right ml-2">
                <p className="text-xs text-gray-500">
                  {formatTime(task.startDate)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {workSchedule.todayTasks.length > 3 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 text-center">
              +{workSchedule.todayTasks.length - 3} more tasks today
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t">
          <Link href="/client/site-schedule">
            <Button variant="outline" size="sm" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
              See More
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Project Status Card (preserved)
function ProjectStatusCard({ 
  activeProject 
}: { 
  activeProject: ActiveProject | null;
}) {
  if (!activeProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Project Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Projects</h3>
            <p className="text-gray-600">Your projects will appear here once assigned.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-600" />
          Project Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{activeProject.title}</h3>
            <p className="text-sm text-gray-600">
              Phase {activeProject.milestoneProgress.currentPhase} of {activeProject.milestoneProgress.totalPhases}
            </p>
          </div>
          <Badge variant="secondary">
            {activeProject.progress}% Complete
          </Badge>
        </div>
        <Progress value={activeProject.progress} className="h-3" />
        {activeProject.milestoneProgress.nextMilestone && (
          <p className="text-sm text-gray-600">
            Next: {activeProject.milestoneProgress.nextMilestone.title}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Updates Component (preserved)
function RecentUpdatesCard({ updates }: { updates: RecentUpdate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-600" />
          Recent Updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {updates.length > 0 ? (
          <div className="space-y-3">
            {updates.slice(0, 5).map((update) => (
              <div key={update._id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0 mt-1">
                  {update.type === 'project_completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : update.type === 'milestone_completed' ? (
                    <Target className="h-4 w-4 text-purple-500" />
                  ) : update.type === 'incident_reported' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Activity className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {update.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {update.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeAgo(new Date(update.timestamp))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Files Component (preserved)
function RecentFilesCard({ files }: { files: RecentFile[] }) {
  const getFileIcon = (category: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      image: <FileText className="h-5 w-5 text-blue-500" />,
      video: <FileText className="h-5 w-5 text-red-500" />,
      audio: <FileText className="h-5 w-5 text-green-500" />,
      document: <FileText className="h-5 w-5 text-purple-500" />,
      other: <FileText className="h-5 w-5 text-gray-500" />
    };
    return iconMap[category] || iconMap.other;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          Recent Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length > 0 ? (
          <div className="space-y-3">
            {files.slice(0, 5).map((file) => (
              <div key={file._id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0">
                  {getFileIcon(file.category)}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.projectTitle} • {formatFileSize(file.size)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeAgo(new Date(file.createdAt))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent files</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// AI Assistant Component (preserved)
function AIAssistantCard() {
  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Need Help?</h3>
            <p className="text-sm text-gray-600 mt-1">
              Get instant answers about your projects
            </p>
          </div>
          <Link href="/client/ai-assistant">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask AI Assistant
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Database functions (proper TypeScript, following project patterns)
async function getMilestoneProgress(projectId: string): Promise<MilestoneProgress> {
  try {
    const { db } = await connectToDatabase();
    
    const milestones = await db.collection<MilestoneDocument>('milestones')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ createdAt: 1 })
      .toArray();

    const completedMilestones = milestones.filter(m => m.status === 'completed');
    const nextMilestone = milestones.find(m => m.status !== 'completed');
    const currentPhase = completedMilestones.length + 1;
    const overallProgress = Math.round((completedMilestones.length / 3) * 100);

    return {
      currentPhase,
      totalPhases: 3,
      completedMilestones: completedMilestones.map(m => ({
        _id: m._id!.toString(),
        projectId: m.projectId.toString(),
        phase: m.phase,
        title: m.title,
        description: m.description,
        status: m.status,
        completedDate: m.completedDate?.toISOString(),
        completedBy: m.completedBy?.toString(),
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString()
      })),
      nextMilestone: nextMilestone ? {
        _id: nextMilestone._id!.toString(),
        projectId: nextMilestone.projectId.toString(),
        phase: nextMilestone.phase,
        title: nextMilestone.title,
        description: nextMilestone.description,
        status: nextMilestone.status,
        completedDate: nextMilestone.completedDate?.toISOString(),
        completedBy: nextMilestone.completedBy?.toString(),
        notes: nextMilestone.notes,
        createdAt: nextMilestone.createdAt.toISOString(),
        updatedAt: nextMilestone.updatedAt.toISOString()
      } : undefined,
      overallProgress
    };
  } catch (error) {
    console.error('Error calculating milestone progress:', error);
    return {
      currentPhase: 1,
      totalPhases: 3,
      completedMilestones: [],
      overallProgress: 0
    };
  }
}

async function getWorkScheduleData(clientId: string): Promise<WorkScheduleWidget> {
  try {
    const { db } = await connectToDatabase();
    
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .project({ _id: 1, title: 1 })
      .toArray();
    
    const projectIds = projects.map(p => p._id);
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const todayTasks = await db.collection('dailyActivities')
      .find({
        projectId: { $in: projectIds },
        plannedDate: { 
          $gte: todayStart,
          $lt: todayEnd
        }
      })
      .limit(3)
      .toArray();
      
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = await db.collection('dailyActivities')
      .find({
        projectId: { $in: projectIds },
        plannedDate: { 
          $gt: todayEnd,
          $lte: weekFromNow
        },
        status: { $ne: 'completed' }
      })
      .sort({ plannedDate: 1 })
      .limit(5)
      .toArray();
      
    const transformTask = (task: Record<string, unknown>): WorkScheduleItem => {
      const project = projects.find(p => p._id.equals(task.projectId as ObjectId));
      return {
        _id: (task._id as ObjectId).toString(),
        title: task.title as string,
        status: task.status as 'pending' | 'in_progress' | 'completed' | 'delayed',
        startDate: task.plannedDate ? (task.plannedDate as Date).toISOString() : new Date().toISOString(),
        contractor: task.contractor as string,
        projectTitle: project?.title || 'Unknown Project'
      };
    };

    return {
      todayTasks: todayTasks.map(transformTask),
      upcomingTasks: upcomingTasks.map(transformTask),
      totalTasks: todayTasks.length + upcomingTasks.length,
      completedToday: todayTasks.filter(task => task.status === 'completed').length
    };
  } catch (error) {
    console.error('Error fetching work schedule data:', error);
    return {
      todayTasks: [],
      upcomingTasks: [],
      totalTasks: 0,
      completedToday: 0
    };
  }
}

async function getClientDashboardData(clientId: string): Promise<DashboardData> {
  try {
    const { db } = await connectToDatabase();

    // Get client's projects with proper filter typing
    const projectQuery: Filter<ProjectDocument> = {
      client: new ObjectId(clientId)
    };

    const projects = await db.collection<ProjectDocument>('projects')
      .find(projectQuery)
      .toArray();

    const projectIds = projects.map(p => p._id);

    // Calculate statistics
    const stats: ClientStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      recentMessages: 0,
      totalFiles: 0,
      totalIncidents: 0,
      activeRisks: 0
    };

    // Get the most active project with milestone progress
    let activeProject: ActiveProject | null = null;
    const currentActiveProject = projects
      .filter(p => p.status === 'in_progress')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    if (currentActiveProject) {
      const milestoneProgress = await getMilestoneProgress(currentActiveProject._id.toString());
      activeProject = {
        _id: currentActiveProject._id.toString(),
        title: currentActiveProject.title,
        description: currentActiveProject.description,
        status: currentActiveProject.status,
        priority: currentActiveProject.priority,
        progress: currentActiveProject.progress,
        milestoneProgress
      };
    }

    // Get recent project updates
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const recentUpdates: RecentUpdate[] = projects
      .filter(project => project.updatedAt >= startOfMonth)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map(project => ({
        _id: project._id.toString(),
        type: project.status === 'completed' ? 'project_completed' : 'project_updated',
        title: `Project ${project.status === 'completed' ? 'completed' : 'updated'}`,
        description: project.title,
        timestamp: project.updatedAt.toISOString(),
        projectTitle: project.title
      }));

    // Get recent files
    const recentFiles = await db.collection('files')
      .find({
        projectId: { $in: projectIds }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const transformedRecentFiles: RecentFile[] = [];
    for (const file of recentFiles) {
      const project = projects.find(p => p._id.equals(file.projectId));
      const uploader = await db.collection('users').findOne({ _id: file.uploadedBy });
      
      transformedRecentFiles.push({
        _id: file._id.toString(),
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        category: file.category,
        projectTitle: project?.title || 'Unknown Project',
        uploadedBy: {
          name: uploader?.name || 'Unknown User'
        },
        createdAt: file.createdAt.toISOString()
      });
    }

    // Get work schedule data
    const workSchedule = await getWorkScheduleData(clientId);

    // Get completed tasks for today
    const completedTasks = workSchedule.todayTasks.filter(task => task.status === 'completed');

    // Get recent incidents
    const recentIncidents = await db.collection('incidents')
      .find({
        projectId: { $in: projectIds }
      })
      .sort({ reportedDate: -1 })
      .limit(5)
      .toArray();

    const transformedIncidents = [];
    for (const incident of recentIncidents) {
      const project = projects.find(p => p._id.equals(incident.projectId));
      transformedIncidents.push({
        _id: incident._id.toString(),
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        reportedDate: incident.reportedDate.toISOString(),
        projectTitle: project?.title || 'Unknown Project'
      });
    }

    // Get active risks
    const activeRisks = await db.collection('risks')
      .find({
        projectId: { $in: projectIds },
        status: { $ne: 'resolved' }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const transformedRisks = [];
    for (const risk of activeRisks) {
      const project = projects.find(p => p._id.equals(risk.projectId));
      transformedRisks.push({
        _id: risk._id.toString(),
        title: risk.title,
        severity: risk.severity,
        status: risk.status,
        likelihood: risk.likelihood,
        impact: risk.impact,
        projectTitle: project?.title || 'Unknown Project',
        createdAt: risk.createdAt.toISOString(),
        updatedAt: risk.updatedAt.toISOString()
      });
    }

    return {
      stats,
      activeProject,
      recentUpdates,
      recentFiles: transformedRecentFiles,
      completedTasks,
      workSchedule,
      recentIncidents: transformedIncidents,
      activeRisks: transformedRisks
    };

  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    
    // Return default values on error
    return {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        recentMessages: 0,
        totalFiles: 0,
        totalIncidents: 0,
        activeRisks: 0
      },
      activeProject: null,
      recentUpdates: [],
      recentFiles: [],
      completedTasks: [],
      workSchedule: {
        todayTasks: [],
        upcomingTasks: [],
        totalTasks: 0,
        completedToday: 0
      },
      recentIncidents: [],
      activeRisks: []
    };
  }
}

// Main dashboard component
export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'client') {
    redirect('/login');
  }

  // Get ALL dynamic data from database
  const {
    stats,
    activeProject,
    recentUpdates,
    recentFiles,
    completedTasks,
    workSchedule,
    recentIncidents,
    activeRisks
  } = await getClientDashboardData(session.user.id);

  return (
    <>
      <div className="space-y-6">
        {/* Header with Work Schedule Widget in top-right corner */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              <span className="lg:hidden">Home</span>
              <span className="hidden lg:block">Client Dashboard</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              <span className="lg:hidden">Welcome back, {session.user.name?.split(' ')[0]}!</span>
              <span className="hidden lg:block">Here&apos;s an overview of your project activities</span>
            </p>
          </div>
          
          {/* Work Schedule Widget in top-right corner (desktop only) */}
          <div className="hidden lg:block flex-shrink-0">
            <WorkScheduleWidget workSchedule={workSchedule} />
          </div>
        </div>

        {/* Mobile Cards - NEW: Mobile app style cards (mobile only) */}
        <div className="lg:hidden space-y-4">
          {/* Primary Cards - Always visible */}
          <div className="grid grid-cols-1 gap-4">
            {/* Today's Report Card */}
            <MobileDashboardCard
              title="Today's Report"
              description="View daily progress reports and project updates"
              href="/client/daily-reports"
              icon={FileText}
              color="green"
              stats={{ 
                value: completedTasks.length, 
                label: "Tasks Completed Today" 
              }}
              subtitle="Daily Activities"
            />

            {/* Site Schedule Card */}
            <MobileDashboardCard
              title="Site Schedule"
              description="Monitor project timeline and upcoming activities"
              href="/client/site-schedule"
              icon={Calendar}
              color="blue"
              stats={{ 
                value: workSchedule.totalTasks, 
                label: "Scheduled Tasks" 
              }}
              subtitle="Work Schedule"
            />
          </div>

          {/* Secondary Cards - Shown when scrolling */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            {/* Incident Reports Card */}
            <MobileDashboardCard
              title="Incident Report"
              description="View safety incidents and project issues"
              href="/client/incidents"
              icon={AlertTriangle}
              color="red"
              stats={recentIncidents.length > 0 ? { 
                value: recentIncidents.length, 
                label: "Recent Incidents" 
              } : undefined}
              isEmpty={recentIncidents.length === 0}
              emptyMessage="No incidents reported"
              subtitle="Safety & Issues"
            />

            {/* Risk Management Card */}
            <MobileDashboardCard
              title="Risk Management"
              description="Monitor project risks and mitigation strategies"
              href="/client/risks"
              icon={Shield}
              color="orange"
              stats={activeRisks.length > 0 ? { 
                value: activeRisks.length, 
                label: "Active Risks" 
              } : undefined}
              isEmpty={activeRisks.length === 0}
              emptyMessage="All risks managed"
              subtitle="Risk Assessment"
            />

            {/* Additional Cards for more features */}
            <MobileDashboardCard
              title="Project Messages"
              description="Communicate with your project team"
              href="/client/messages"
              icon={MessageSquare}
              color="purple"
              stats={{ 
                value: stats.recentMessages, 
                label: "Recent Messages" 
              }}
              subtitle="Team Communication"
            />

            <MobileDashboardCard
              title="Project Files"
              description="Access project documents and files"
              href="/client/files"
              icon={FileText}
              color="pink"
              stats={{ 
                value: recentFiles.length, 
                label: "Recent Files" 
              }}
              subtitle="Documents & Media"
            />
          </div>
        </div>

        {/* Enhanced Header for desktop */}
        <div className="hidden lg:block bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {session.user.name}!
              </h2>
              <p className="text-blue-100">
                Monitor your project progress and stay updated with real-time information
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{stats.activeProjects}</p>
              <p className="text-blue-100 text-sm">Active Projects</p>
            </div>
          </div>
        </div>

        {/* Updated Dashboard Cards with new features (desktop only) */}
        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="Daily Activities"
            description="View daily progress reports, incident reports, and risk assessments"
            href="/client/daily-reports"
            icon={Activity}
            color="green"
            stats={{ value: stats.activeProjects, label: "Active Reports" }}
          />
          
          <DashboardCard
            title="Site Schedule"
            description="Monitor project timeline, milestones, and upcoming activities"
            href="/client/site-schedule"
            icon={Calendar}
            color="blue"
            stats={{ value: workSchedule.totalTasks, label: "Scheduled Tasks" }}
          />
          
          <DashboardCard
            title="Project Milestones"
            description="Track construction, installation, and styling phases"
            href="/client/projects"
            icon={Target}
            color="purple"
            stats={{ value: activeProject?.milestoneProgress.currentPhase || 0, label: "Current Phase" }}
          />
        </div>

        {/* Dashboard Grid - FULL ORIGINAL FUNCTIONALITY (desktop only) */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Status and Comments */}
          <div className="lg:col-span-1 space-y-6">
            {/* Project Status with Milestone Tracking */}
            <ProjectStatusCard activeProject={activeProject} />
            
            {/* AI Assistant */}
            <AIAssistantCard />
          </div>

          {/* Right Column - Activity Feed and Recent Files */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Updates */}
            <RecentUpdatesCard updates={recentUpdates} />
            
            {/* Recent Files */}
            <RecentFilesCard files={recentFiles} />
          </div>
        </div>
        
      </div>
{/* Floating AI Chatbot - FIXED: Responsive positioning for mobile bottom nav */}
<Suspense fallback={null}>
  <div 
    style={{
      position: 'fixed',
      bottom: '2rem', // Desktop spacing
      right: '2rem',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      transform: 'translateZ(0)',
      willChange: 'transform',
      minHeight: '56px',
      minWidth: '56px'
    }}
    className="floating-ai-button-container"
  >
    <FloatingAIChatbot />
  </div>
</Suspense>
      
    </>
    
  );
}