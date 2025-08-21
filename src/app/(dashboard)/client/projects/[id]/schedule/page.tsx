// src/app/(dashboard)/client/projects/[id]/schedule/page.tsx - COMPLETE CLIENT PROJECT SCHEDULE
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ArrowLeft,
  Eye,
  Download,
  Activity,
  Users,
  MapPin,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Enhanced TypeScript interfaces for better type safety
interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate: string;
  endDate: string;
  manager: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  client: {
    _id: string;
    name: string;
    email: string;
  };
}

interface SiteSchedulePhase {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress: number;
  activities: SiteActivity[];
  dependencies?: string[];
}

interface SiteActivity {
  _id: string;
  title: string;
  description?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  contractor?: string;
  supervisor?: string;
  estimatedDuration: string;
  actualDuration?: string;
  prerequisites?: string[];
  resources?: string[];
  progress: number;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface DailyProgress {
  date: string;
  summary: {
    totalActivities: number;
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
  };
  weatherConditions?: string;
  crewSize?: number;
  totalHours?: number;
  notes?: string;
  photos?: string[];
}

interface ProjectScheduleData {
  project: Project;
  phases: SiteSchedulePhase[];
  upcomingActivities: SiteActivity[];
  recentProgress: DailyProgress[];
  overallStats: {
    totalActivities: number;
    completedActivities: number;
    activeActivities: number;
    delayedActivities: number;
    overallProgress: number;
    onSchedule: boolean;
    daysRemaining?: number;
  };
}

// Add interface for MongoDB phase document
interface MongoPhaseDocument {
  _id?: ObjectId;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'upcoming' | 'active' | 'completed' | 'delayed';
  progress?: number;
  activities?: MongoActivityDocument[];
  dependencies?: string[];
}

// Add interface for MongoDB activity document
interface MongoActivityDocument {
  _id?: ObjectId;
  title: string;
  description?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status?: 'pending' | 'in_progress' | 'completed' | 'delayed';
  contractor?: string;
  supervisor?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  prerequisites?: string[];
  resources?: string[];
  progress?: number;
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

// Utility functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress': 
    case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending':
    case 'upcoming': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'delayed': return 'bg-red-100 text-red-800 border-red-200';
    case 'on_hold': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
  }
  
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const calculateDaysRemaining = (endDate: string): number => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Server-side data fetching function
async function getProjectScheduleData(projectId: string, clientId: string): Promise<ProjectScheduleData> {
  try {
    const { db } = await connectToDatabase();

    // Fetch project with validation
    const project = await db.collection('projects')
      .findOne({ 
        _id: new ObjectId(projectId),
        client: new ObjectId(clientId) // Ensure client can only access their projects
      });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Fetch site schedule data
    const siteSchedule = project.siteSchedule || { phases: [] };

    // Fetch recent daily progress (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentProgress = await db.collection('dailyProgress')
      .find({
        project: new ObjectId(projectId),
        date: { $gte: sevenDaysAgo }
      })
      .sort({ date: -1 })
      .limit(7)
      .toArray();

    // Get project manager details
    const manager = await db.collection('users')
      .findOne(
        { _id: project.manager },
        { projection: { password: 0 } }
      );

    // Process phases and activities
    const phases: SiteSchedulePhase[] = (siteSchedule.phases || []).map((phase: MongoPhaseDocument) => ({
      _id: phase._id?.toString() || new ObjectId().toString(),
      name: phase.name,
      description: phase.description,
      startDate: phase.startDate?.toISOString() || new Date().toISOString(),
      endDate: phase.endDate?.toISOString() || new Date().toISOString(),
      status: phase.status || 'upcoming',
      progress: phase.progress || 0,
      activities: (phase.activities || []).map((activity: MongoActivityDocument) => ({
        _id: activity._id?.toString() || new ObjectId().toString(),
        title: activity.title,
        description: activity.description,
        plannedStartDate: activity.plannedStartDate?.toISOString() || new Date().toISOString(),
        plannedEndDate: activity.plannedEndDate?.toISOString() || new Date().toISOString(),
        actualStartDate: activity.actualStartDate?.toISOString(),
        actualEndDate: activity.actualEndDate?.toISOString(),
        status: activity.status || 'pending',
        contractor: activity.contractor,
        supervisor: activity.supervisor,
        estimatedDuration: activity.estimatedDuration || 'TBD',
        actualDuration: activity.actualDuration,
        prerequisites: activity.prerequisites || [],
        resources: activity.resources || [],
        progress: activity.progress || 0,
        category: activity.category || 'other',
        priority: activity.priority || 'medium'
      })),
      dependencies: phase.dependencies || []
    }));

    // Calculate upcoming activities (next 14 days)
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    const upcomingActivities: SiteActivity[] = phases
      .flatMap(phase => phase.activities)
      .filter(activity => {
        const startDate = new Date(activity.plannedStartDate);
        return startDate <= fourteenDaysFromNow && 
               ['pending', 'in_progress'].includes(activity.status);
      })
      .sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime())
      .slice(0, 10);

    // Calculate overall statistics
    const allActivities = phases.flatMap(phase => phase.activities);
    const completedActivities = allActivities.filter(a => a.status === 'completed');
    const activeActivities = allActivities.filter(a => a.status === 'in_progress');
    const delayedActivities = allActivities.filter(a => a.status === 'delayed');

    const overallProgress = allActivities.length > 0 
      ? Math.round((completedActivities.length / allActivities.length) * 100)
      : 0;

    const daysRemaining = project.endDate ? calculateDaysRemaining(project.endDate.toISOString()) : undefined;
    const onSchedule = delayedActivities.length === 0 && (daysRemaining === undefined || daysRemaining > 0);

    return {
      project: {
        _id: project._id.toString(),
        title: project.title,
        description: project.description,
        status: project.status,
        priority: project.priority,
        progress: project.progress || 0,
        startDate: project.startDate?.toISOString() || '',
        endDate: project.endDate?.toISOString() || '',
        manager: {
          _id: manager?._id?.toString() || '',
          name: manager?.name || 'Unknown',
          email: manager?.email || '',
          phone: manager?.phone
        },
        client: {
          _id: project.client.toString(),
          name: project.clientName || 'Unknown Client',
          email: project.clientEmail || ''
        }
      },
      phases,
      upcomingActivities,
      recentProgress: recentProgress.map(progress => ({
        date: progress.date.toISOString(),
        summary: progress.summary || {
          totalActivities: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          delayed: 0
        },
        weatherConditions: progress.weatherConditions,
        crewSize: progress.crewSize,
        totalHours: progress.totalHours,
        notes: progress.notes,
        photos: progress.photos || []
      })),
      overallStats: {
        totalActivities: allActivities.length,
        completedActivities: completedActivities.length,
        activeActivities: activeActivities.length,
        delayedActivities: delayedActivities.length,
        overallProgress,
        onSchedule,
        daysRemaining
      }
    };

  } catch (error) {
    console.error('Error fetching project schedule data:', error);
    throw new Error('Failed to fetch project schedule data');
  }
}

// Loading component
function ScheduleLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Phase Overview Component
function PhaseOverviewCard({ phases }: { phases: SiteSchedulePhase[] }) {
  const activePhasesCount = phases.filter(p => p.status === 'active').length;
  const completedPhasesCount = phases.filter(p => p.status === 'completed').length;
  const upcomingPhasesCount = phases.filter(p => p.status === 'upcoming').length;
  const delayedPhasesCount = phases.filter(p => p.status === 'delayed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Project Phases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xl font-bold text-blue-700">{activePhasesCount}</p>
            <p className="text-xs text-blue-600">Active</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xl font-bold text-green-700">{completedPhasesCount}</p>
            <p className="text-xs text-green-600">Completed</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xl font-bold text-yellow-700">{upcomingPhasesCount}</p>
            <p className="text-xs text-yellow-600">Upcoming</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xl font-bold text-red-700">{delayedPhasesCount}</p>
            <p className="text-xs text-red-600">Delayed</p>
          </div>
        </div>

        {phases.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Recent Phases</h4>
            {phases.slice(0, 3).map((phase) => (
              <div key={phase._id} className="border-l-2 border-blue-500 pl-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">{phase.name}</p>
                  <Badge className={getStatusColor(phase.status)}>
                    {phase.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600 text-xs">
                    {formatDateRange(phase.startDate, phase.endDate)}
                  </span>
                  <span className="text-gray-500 text-xs">{phase.progress}%</span>
                </div>
                <Progress value={phase.progress} className="h-1 mt-1" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Upcoming Activities Component
function UpcomingActivitiesCard({ activities }: { activities: SiteActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          Upcoming Activities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No upcoming activities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity._id} className="border-l-2 border-orange-500 pl-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                  <Badge className={getPriorityColor(activity.priority)}>
                    {activity.priority}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600 text-xs">
                    {formatDate(activity.plannedStartDate)}
                  </span>
                  <span className="text-gray-500 text-xs">{activity.estimatedDuration}</span>
                </div>
                {activity.contractor && (
                  <p className="text-gray-500 text-xs mt-1">
                    Contractor: {activity.contractor}
                  </p>
                )}
              </div>
            ))}
            {activities.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-gray-500 text-xs">
                  +{activities.length - 5} more activities
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Progress Component
function RecentProgressCard({ progressData }: { progressData: DailyProgress[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          Recent Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {progressData.length === 0 ? (
          <div className="text-center py-6">
            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No recent progress data</p>
          </div>
        ) : (
          <div className="space-y-3">
            {progressData.slice(0, 3).map((progress, index) => (
              <div key={index} className="border-l-2 border-green-500 pl-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">
                    {formatDate(progress.date)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {progress.summary.completed} completed
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <span className="text-green-600">✓ {progress.summary.completed} done</span>
                  <span className="text-blue-600">→ {progress.summary.inProgress} active</span>
                </div>
                {progress.weatherConditions && (
                  <p className="text-gray-500 text-xs mt-1">
                    Weather: {progress.weatherConditions}
                  </p>
                )}
                {progress.notes && (
                  <p className="text-gray-600 text-xs mt-1 truncate">
                    {progress.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Schedule Component
interface ClientProjectSchedulePageProps {
  params: Promise<{
    id: string;
  }>;
}

async function ClientProjectSchedulePage({ params }: ClientProjectSchedulePageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this schedule.</p>
        </div>
      </div>
    );
  }

  const { id } = await params;
  let scheduleData: ProjectScheduleData;
  
  try {
    scheduleData = await getProjectScheduleData(id, session.user.id);
  } catch (error) {
    console.error('Error loading schedule:', error);
    notFound();
  }

  const { project, phases, upcomingActivities, recentProgress, overallStats } = scheduleData;

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/client/projects/${project._id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Work Schedule
            </h1>
            <p className="text-gray-600 mt-1">{project.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(project.status)}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Link href={`/client/messages?project=${project._id}`}>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Contact Team
            </Button>
          </Link>
        </div>
      </div>

      {/* Project Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.totalActivities}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-blue-600 font-medium">{overallStats.activeActivities} active</span>
              <span className="text-gray-500 ml-2">• {overallStats.completedActivities} done</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Progress</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.overallProgress}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4">
              <Progress value={overallStats.overallProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Schedule Status</p>
                <p className="text-lg font-bold text-gray-900">
                  {overallStats.onSchedule ? 'On Track' : 'Delayed'}
                </p>
              </div>
              {overallStats.onSchedule ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <div className="mt-4 flex items-center text-sm">
              {overallStats.delayedActivities > 0 ? (
                <span className="text-red-600 font-medium">{overallStats.delayedActivities} delayed</span>
              ) : (
                <span className="text-green-600 font-medium">No delays</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Timeline</p>
                <p className="text-lg font-bold text-gray-900">
                  {overallStats.daysRemaining !== undefined 
                    ? `${Math.max(0, overallStats.daysRemaining)} days`
                    : 'TBD'
                  }
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-purple-600 font-medium">
                {overallStats.daysRemaining !== undefined && overallStats.daysRemaining > 0 
                  ? 'remaining'
                  : 'to completion'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PhaseOverviewCard phases={phases} />
        <UpcomingActivitiesCard activities={upcomingActivities} />
        <RecentProgressCard progressData={recentProgress} />
      </div>

      {/* Detailed Schedule Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detailed Schedule
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Full View
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phases" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="phases">Phases</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="phases" className="space-y-4">
              {phases.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Phases Defined</h3>
                  <p className="text-gray-600">The project schedule is being prepared by your project manager.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <Card key={phase._id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <p className="text-gray-600 text-sm mb-2">{phase.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>{formatDateRange(phase.startDate, phase.endDate)}</span>
                              <span>•</span>
                              <span>{phase.activities.length} activities</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(phase.status)}>
                              {phase.status}
                            </Badge>
                            <div className="text-right">
                              <p className="text-sm font-medium">{phase.progress}%</p>
                              <Progress value={phase.progress} className="w-20 h-2" />
                            </div>
                          </div>
                        </div>

                        {phase.activities.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-gray-700 mb-3">Key Activities</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {phase.activities.slice(0, 4).map((activity) => (
                                <div key={activity._id} className="border rounded-lg p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-gray-900 text-sm">{activity.title}</h5>
                                    <Badge className={getStatusColor(activity.status)} variant="outline">
                                      {activity.status}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-600 space-y-1">
                                    <p>📅 {formatDate(activity.plannedStartDate)}</p>
                                    <p>⏱️ {activity.estimatedDuration}</p>
                                    {activity.contractor && <p>👷 {activity.contractor}</p>}
                                  </div>
                                  <Progress value={activity.progress} className="h-1 mt-2" />
                                </div>
                              ))}
                            </div>
                            {phase.activities.length > 4 && (
                              <p className="text-center text-gray-500 text-sm mt-3">
                                +{phase.activities.length - 4} more activities
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              {upcomingActivities.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Activities</h3>
                  <p className="text-gray-600">All activities are completed or scheduled for later.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingActivities.map((activity) => (
                    <Card key={activity._id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-medium text-gray-900">{activity.title}</h3>
                          <Badge className={getPriorityColor(activity.priority)} variant="outline">
                            {activity.priority}
                          </Badge>
                        </div>
                        
                        {activity.description && (
                          <p className="text-gray-600 text-sm mb-3">{activity.description}</p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Planned Start:</span>
                            <span className="font-medium">{formatDate(activity.plannedStartDate)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Duration:</span>
                            <span className="font-medium">{activity.estimatedDuration}</span>
                          </div>
                          {activity.contractor && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Contractor:</span>
                              <span className="font-medium">{activity.contractor}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Category:</span>
                            <Badge variant="outline" className="text-xs">
                              {activity.category}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">Progress</span>
                            <span className="text-sm font-medium">{activity.progress}%</span>
                          </div>
                          <Progress value={activity.progress} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-medium text-yellow-800">Timeline View</h3>
                </div>
                <p className="text-yellow-700 text-sm">
                  Interactive timeline view is coming soon. For now, you can view the detailed schedule in the Phases and Activities tabs above.
                </p>
              </div>

              {/* Project Timeline Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Timeline Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900">Project Start</p>
                        <p className="text-blue-700 text-sm">{formatDate(project.startDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-blue-900">Expected Completion</p>
                        <p className="text-blue-700 text-sm">{formatDate(project.endDate)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {phases.map((phase, index) => (
                        <div key={phase._id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${
                              phase.status === 'completed' ? 'bg-green-500' :
                              phase.status === 'active' ? 'bg-blue-500' :
                              phase.status === 'delayed' ? 'bg-red-500' :
                              'bg-gray-300'
                            }`} />
                            <h4 className="font-medium text-gray-900">Phase {index + 1}</h4>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">{phase.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatDateRange(phase.startDate, phase.endDate)}
                          </p>
                          <Progress value={phase.progress} className="h-1 mt-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrap with Suspense for loading state
export default function ClientProjectSchedulePageWrapper(props: ClientProjectSchedulePageProps) {
  return (
    <Suspense fallback={<ScheduleLoading />}>
      <ClientProjectSchedulePage {...props} />
    </Suspense>
  );
}