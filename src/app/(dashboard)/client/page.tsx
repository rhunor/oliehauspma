// src/app/(dashboard)/client/page.tsx - UPDATED WITH ALL REQUESTED FEATURES
import { Suspense } from 'react';
import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import Link from 'next/link';
import { 
  Activity,
  Calendar,
  FolderOpen,
  TrendingUp,
  CheckCircle,
  MessageCircle,
  FileText,
  ChevronRight,
  Eye,
  Clock,
  Download,
  BarChart3,
  Target,
  AlertTriangle,
  Shield,
  MessageSquare,
  Users,
  Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

// Import our new types - following TypeScript best practices
import type { 
  ProjectMilestone, 
  MilestoneProgress, 
  WorkScheduleWidget, 
  WorkScheduleItem 
} from '@/lib/types/milestone';
import type { IncidentReport } from '@/lib/types/incident';
import type { RiskRegisterItem } from '@/lib/types/risk';

// TypeScript interfaces following best practices - avoiding 'any' type
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

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  client: ObjectId;
  manager: ObjectId;
  milestones?: ProjectMilestone[];
  createdAt: Date;
  updatedAt: Date;
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
  type: 'project_updated' | 'project_completed' | 'milestone_completed' | 'incident_reported';
  title: string;
  description: string;
  timestamp: string;
  project: {
    _id: string;
    title: string;
  };
}

interface RecentFile {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  category: string;
  uploadedAt: Date;
  uploadedBy: {
    name: string;
  };
  project: {
    title: string;
  };
}

interface CompletedTask {
  _id: string;
  title: string;
  description?: string;
  completedDate: string;
  projectTitle: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  quality?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement';
}

interface DashboardData {
  stats: ClientStats;
  activeProject: ActiveProject | null;
  recentUpdates: RecentUpdate[];
  recentFiles: RecentFile[];
  completedTasks: CompletedTask[];
  workSchedule: WorkScheduleWidget;
  recentIncidents: IncidentReport[];
  activeRisks: RiskRegisterItem[];
}

// Server function to calculate milestone progress
async function getMilestoneProgress(projectId: string): Promise<MilestoneProgress> {
  try {
    const { db } = await connectToDatabase();
    
    const milestones = await db.collection('milestones')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ createdAt: 1 })
      .toArray();

    const completedMilestones = milestones.filter(m => m.status === 'completed');
    const nextMilestone = milestones.find(m => m.status !== 'completed');

    const currentPhase = completedMilestones.length + 1;
    const totalPhases = 3; // Construction, Installation, Styling
    const overallProgress = Math.round((completedMilestones.length / totalPhases) * 100);

    return {
      currentPhase,
      totalPhases,
      completedMilestones: completedMilestones.map(m => ({
        _id: m._id.toString(),
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
        _id: nextMilestone._id.toString(),
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

// Server function to fetch work schedule data
async function getWorkScheduleData(clientId: string): Promise<WorkScheduleWidget> {
  try {
    const { db } = await connectToDatabase();
    
    // Get client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .project({ _id: 1, title: 1 })
      .toArray();
    
    const projectIds = projects.map(p => p._id);
    
    // Get today's date
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    // Get today's tasks from daily activities
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
      
    // Get upcoming tasks (next 7 days)
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
      
    // Transform data
    const transformTask = (task: Record<string, unknown>): WorkScheduleItem => {
      const project = projects.find(p => p._id.equals(task.projectId as ObjectId));
      return {
        _id: (task._id as ObjectId).toString(),
        title: task.title as string,
        description: task.description as string,
        projectId: (task.projectId as ObjectId).toString(),
        projectTitle: project?.title || 'Unknown Project',
        phase: task.phase as string,
        status: (task.status as WorkScheduleItem['status']) || 'pending',
        priority: (task.priority as WorkScheduleItem['priority']) || 'medium',
        assignedTo: task.assignedTo as string,
        contractor: task.contractor as string,
        startDate: (task.plannedDate as Date).toISOString(),
        endDate: (task.plannedDate as Date).toISOString(), // For daily activities, same date
        estimatedDuration: task.estimatedDuration as string,
        progress: (task.progress as number) || 0,
        category: (task.category as WorkScheduleItem['category']) || 'other'
      };
    };

    return {
      todayTasks: todayTasks.map(transformTask),
      upcomingTasks: upcomingTasks.map(transformTask),
      totalTasks: todayTasks.length + upcomingTasks.length,
      completedToday: todayTasks.filter(task => task.status === 'completed').length,
      nextMilestone: undefined // Will be populated if milestone system is active
    };
  } catch (error) {
    console.error('Error fetching work schedule:', error);
    return {
      todayTasks: [],
      upcomingTasks: [],
      totalTasks: 0,
      completedToday: 0
    };
  }
}

// Server function to fetch completed tasks
async function getCompletedTasks(clientId: string): Promise<CompletedTask[]> {
  try {
    const { db } = await connectToDatabase();
    
    // Get client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .project({ _id: 1 })
      .toArray();
    
    const projectIds = projects.map(p => p._id);
    
    // Get completed tasks from client's projects
    const completedTasks = await db.collection('tasks')
      .aggregate([
        {
          $match: {
            projectId: { $in: projectIds },
            status: 'completed',
            completedAt: { $exists: true }
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project',
            pipeline: [{ $project: { title: 1 } }]
          }
        },
        {
          $addFields: {
            project: { $arrayElemAt: ['$project', 0] }
          }
        },
        { $sort: { completedAt: -1 } },
        { $limit: 50 } // Get recent 50 completed tasks
      ])
      .toArray();
    
    return completedTasks.map(task => ({
      _id: task._id.toString(),
      title: task.title,
      description: task.description,
      completedDate: task.completedAt.toISOString(),
      projectTitle: task.project?.title || 'Unknown Project',
      category: task.category || 'other',
      quality: task.quality
    }));
  } catch (error) {
    console.error('Error fetching completed tasks:', error);
    return [];
  }
}

// Server function to fetch recent incidents
async function getRecentIncidents(clientId: string): Promise<IncidentReport[]> {
  try {
    const { db } = await connectToDatabase();
    
    // Get client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .project({ _id: 1 })
      .toArray();
    
    const projectIds = projects.map(p => p._id);
    
    // Get recent incidents
    const incidents = await db.collection('incidentReports')
      .find({
        projectId: { $in: projectIds }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
      
    return incidents.map((incident): IncidentReport => ({
      _id: incident._id.toString(),
      projectId: incident.projectId.toString(),
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
      location: incident.location,
      dateOccurred: incident.dateOccurred.toISOString(),
      timeOccurred: incident.timeOccurred,
      reportedBy: incident.reportedBy.toString(),
      reportedByName: incident.reportedByName || 'Unknown',
      witnessNames: incident.witnessNames,
      injuryDetails: incident.injuryDetails,
      equipmentInvolved: incident.equipmentInvolved,
      weatherConditions: incident.weatherConditions,
      immediateActions: incident.immediateActions,
      rootCause: incident.rootCause,
      correctiveActions: incident.correctiveActions,
      preventiveActions: incident.preventiveActions,
      status: incident.status,
      priority: incident.priority,
      assignedTo: incident.assignedTo?.toString(),
      photos: incident.photos,
      documents: incident.documents,
      followUpRequired: incident.followUpRequired,
      followUpDate: incident.followUpDate?.toISOString(),
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }
}

// Server function to fetch active risks
async function getActiveRisks(clientId: string): Promise<RiskRegisterItem[]> {
  try {
    const { db } = await connectToDatabase();
    
    // Get client's projects
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) })
      .project({ _id: 1 })
      .toArray();
    
    const projectIds = projects.map(p => p._id);
    
    // Get active risks
    const risks = await db.collection('riskRegister')
      .find({
        projectId: { $in: projectIds },
        status: { $in: ['identified', 'assessed', 'mitigated'] }
      })
      .sort({ riskScore: -1 })
      .limit(5)
      .toArray();
      
    return risks.map((risk): RiskRegisterItem => ({
      _id: risk._id.toString(),
      projectId: risk.projectId.toString(),
      riskCode: risk.riskCode,
      riskDescription: risk.riskDescription,
      category: risk.category,
      probability: risk.probability,
      impact: risk.impact,
      riskScore: risk.riskScore,
      triggers: risk.triggers,
      mitigationStrategy: risk.mitigationStrategy,
      contingencyPlan: risk.contingencyPlan,
      owner: risk.owner.toString(),
      ownerName: risk.ownerName || 'Unknown',
      status: risk.status,
      reviewDate: risk.reviewDate?.toISOString(),
      lastReviewDate: risk.lastReviewDate?.toISOString(),
      residualProbability: risk.residualProbability,
      residualImpact: risk.residualImpact,
      residualScore: risk.residualScore,
      actionItems: risk.actionItems?.map((item: Record<string, unknown>) => ({
        action: item.action as string,
        assignedTo: (item.assignedTo as ObjectId).toString(),
        dueDate: (item.dueDate as Date).toISOString(),
        status: item.status as 'pending' | 'in_progress' | 'completed',
        completedDate: (item.completedDate as Date)?.toISOString()
      })),
      createdAt: risk.createdAt.toISOString(),
      updatedAt: risk.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching active risks:', error);
    return [];
  }
}

// Server function to fetch client dashboard data
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
        title: `Project ${project.status === 'completed' ? 'Completed' : 'Updated'}`,
        description: project.title,
        timestamp: (project.updatedAt || project.createdAt).toISOString(),
        project: {
          _id: project._id.toString(),
          title: project.title
        }
      }));

    // Fetch recent files with error handling
    let recentFiles: RecentFile[] = [];
    try {
      const files = await db.collection('files')
        .find({ 
          projectId: { $in: projectIds },
          uploadedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .toArray();

      recentFiles = files.map(file => ({
        _id: file._id.toString(),
        filename: file.filename || 'Unknown',
        originalName: file.originalName || 'Unknown',
        size: file.size || 0,
        category: file.category || 'other',
        uploadedAt: file.uploadedAt || new Date(),
        uploadedBy: file.uploadedBy || { name: 'Unknown' },
        project: file.project || { title: 'Unknown Project' }
      }));

      stats.totalFiles = files.length;
    } catch (error) {
      console.log('Files collection not found or error fetching files:', error);
      recentFiles = [];
    }

    // Fetch additional statistics with error handling
    try {
      // Count tasks
      const taskCount = await db.collection('tasks')
        .countDocuments({ projectId: { $in: projectIds } });
      
      const completedTaskCount = await db.collection('tasks')
        .countDocuments({ 
          projectId: { $in: projectIds },
          status: 'completed' 
        });

      stats.completedTasks = completedTaskCount;
      stats.pendingTasks = taskCount - completedTaskCount;

      // Count recent messages
      const messageCount = await db.collection('messages')
        .countDocuments({
          projectId: { $in: projectIds },
          createdAt: { $gte: startOfMonth }
        });
      
      stats.recentMessages = messageCount;

      // Count incidents and risks
      const incidentCount = await db.collection('incidentReports')
        .countDocuments({ projectId: { $in: projectIds } });
        
      const riskCount = await db.collection('riskRegister')
        .countDocuments({ 
          projectId: { $in: projectIds },
          status: { $in: ['identified', 'assessed', 'mitigated'] }
        });
      
      stats.totalIncidents = incidentCount;
      stats.activeRisks = riskCount;
    } catch (error) {
      console.log('Some collections not found, using default values:', error);
    }

    // Fetch all required data concurrently for better performance
    const [completedTasks, workSchedule, recentIncidents, activeRisks] = await Promise.all([
      getCompletedTasks(clientId),
      getWorkScheduleData(clientId),
      getRecentIncidents(clientId),
      getActiveRisks(clientId)
    ]);

    return {
      stats,
      activeProject,
      recentUpdates,
      recentFiles,
      completedTasks,
      workSchedule,
      recentIncidents,
      activeRisks
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

// Dashboard Card Component with proper TypeScript typing
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
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full">
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

// ✅ NEW: Server Component version of Work Schedule Widget (NO useState)
// Uses static rendering with current task state passed as props
function WorkScheduleWidget({ 
  workSchedule, 
  className = "" 
}: { 
  workSchedule: WorkScheduleWidget;
  className?: string;
}) {
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      delayed: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Show first 3 tasks by default, remaining tasks can be viewed via "See More" link
  const displayedTasks = workSchedule.todayTasks.slice(0, 3);

  return (
    <Card className={`${className} w-80 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Work Schedule
          </CardTitle>
          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
            {workSchedule.completedToday}/{workSchedule.totalTasks} today
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Show first 3 tasks statically */}
        <div className="space-y-2">
          {displayedTasks.map((task) => (
            <div key={task._id} className="flex items-center justify-between p-2 bg-white rounded-lg border">
              <div className="flex-1 min-w-0">
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

        {/* Static notice for additional tasks */}
        {workSchedule.todayTasks.length > 3 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 text-center">
              +{workSchedule.todayTasks.length - 3} more tasks today
            </p>
          </div>
        )}

        {/* See More button */}
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

// ✅ NEW: Server Component version of Project Status with Milestone Tracking
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
          <div className="text-center py-6">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No active projects</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { milestoneProgress } = activeProject;
  const phaseNames: Record<string, string> = {
    construction: 'Construction Phase',
    installation: 'Installation Phase',
    styling: 'Set up and Styling Phase'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-600" />
          Project Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">{activeProject.title}</h3>
          
          {/* Milestone Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Milestone Progress</span>
              <span className="text-sm font-medium">
                {milestoneProgress.currentPhase - 1}/{milestoneProgress.totalPhases} completed
              </span>
            </div>
            
            {/* Progress Steps */}
            <div className="space-y-2">
              {['construction', 'installation', 'styling'].map((phase, index) => {
                const isCompleted = milestoneProgress.completedMilestones.some(m => m.phase === phase);
                const isCurrent = index === milestoneProgress.currentPhase - 1;
                
                return (
                  <div key={phase} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-green-500 text-white' 
                        : isCurrent 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-500'}`}>
                        {phaseNames[phase]}
                      </p>
                      {isCompleted && (
                        <p className="text-xs text-gray-500">
                          ✓ Completed
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Overall Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Overall Progress</span>
                <span className="font-medium">{milestoneProgress.overallProgress}%</span>
              </div>
              <Progress value={milestoneProgress.overallProgress} className="h-2" />
            </div>
          </div>
        </div>
        
        <Link href={`/client/projects/${activeProject._id}`}>
          <Button className="w-full" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View Project Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Scrollable Completed Tasks Component (Already implemented)
function CompletedTasksCard({ 
  completedTasks 
}: { 
  completedTasks: CompletedTask[];
}) {
  const getCategoryIcon = (category: string) => {
    const iconClasses = "h-4 w-4";
    switch (category) {
      case 'structural': return <Clock className={`${iconClasses} text-blue-500`} />;
      case 'electrical': return <CheckCircle className={`${iconClasses} text-yellow-500`} />;
      case 'plumbing': return <FileText className={`${iconClasses} text-cyan-500`} />;
      case 'finishing': return <Activity className={`${iconClasses} text-purple-500`} />;
      default: return <CheckCircle className={`${iconClasses} text-gray-500`} />;
    }
  };

  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'satisfactory': return 'bg-yellow-100 text-yellow-800';
      case 'needs_improvement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Completed Tasks
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {completedTasks.length} tasks
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {completedTasks.length > 0 ? (
          <div className="max-h-64 sm:max-h-72 md:max-h-80 overflow-y-auto px-6 pb-6 scroll-smooth">
            <div className="space-y-3">
              {completedTasks.map((task, index) => (
                <div 
                  key={task._id} 
                  className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-150 ${
                    index === completedTasks.length - 1 ? '' : 'border-b border-gray-100'
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getCategoryIcon(task.category)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            <span className="truncate max-w-24 sm:max-w-none">
                              {task.projectTitle}
                            </span>
                          </span>
                          <span>•</span>
                          <span>{formatTimeAgo(task.completedDate)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2">
                        {task.quality && (
                          <Badge 
                            className={`text-xs px-2 py-1 ${getQualityColor(task.quality)}`}
                          >
                            {task.quality.replace('_', ' ')}
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className="text-xs px-2 py-1 bg-green-50 text-green-700 border-green-200"
                        >
                          ✓ Done
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {completedTasks.length >= 50 
                  ? 'Showing recent 50 completed tasks' 
                  : `${completedTasks.length} completed task${completedTasks.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-6">
            <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm text-gray-600">No completed tasks yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Completed tasks will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ✅ NEW: Server Component version of Enhanced Comments Notification (NO useState)
function CommentsNotificationCard() {
  // Server component - static rendering, no client state
  const hasNewComments = true; // This could be fetched from server data

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-600" />
          Comments & Communication
          {hasNewComments && (
            <Badge className="bg-red-500 text-white text-xs">New</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">
            You can now comment on any task! Your feedback helps us deliver better results.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <Link href="/client/tasks">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comment on Tasks
              </Button>
            </Link>
            <Link href="/client/messages">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Team Messages
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function getFileIcon(category: string) {
  const iconMap: Record<string, React.ReactElement> = {
    image: <FileText className="h-5 w-5 text-blue-500" />,
    video: <FileText className="h-5 w-5 text-red-500" />,
    audio: <FileText className="h-5 w-5 text-green-500" />,
    document: <FileText className="h-5 w-5 text-purple-500" />,
    other: <FileText className="h-5 w-5 text-gray-500" />
  };
  return iconMap[category] || iconMap.other;
}

function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return priorityColors[priority] || 'bg-gray-100 text-gray-800';
}

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    on_hold: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}

// Recent Updates Component
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

// Recent Files Component
function RecentFilesCard({ files }: { files: RecentFile[] }) {
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
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(file.uploadedAt)}</span>
                    {file.project && (
                      <>
                        <span>•</span>
                        <span className="truncate">{file.project.title}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No recent files</p>
            <Link href="/client/files">
              <Button variant="outline" size="sm" className="mt-2">
                Browse Files
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this dashboard.</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Client Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Here&apos;s an overview of your project activities
            </p>
          </div>
          
          {/* ✅ NEW: Work Schedule Widget in top-right corner as requested (NO useState) */}
          <div className="flex-shrink-0">
            <WorkScheduleWidget workSchedule={workSchedule} />
          </div>
        </div>

        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
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

        {/* Updated Dashboard Cards with new features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Additional feature cards */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DashboardCard
            title="Team Messages"
            description="Communicate with your project team and comment on tasks"
            href="/client/messages"
            icon={MessageCircle}
            color="orange"
            stats={{ value: stats.recentMessages, label: "Recent Messages" }}
          /> */}
          
          {/* <DashboardCard
            title="Documents"
            description="Access project files and documents"
            href="/client/files"
            icon={FileText}
            color="blue"
            stats={{ value: stats.totalFiles, label: "Files Available" }}
          /> */}

          {/* <DashboardCard
            title="Incident Reports"
            description="View safety and incident reports for your projects"
            href="/client/incidents"
            icon={AlertTriangle}
            color="red"
            stats={{ value: stats.totalIncidents, label: "Total Incidents" }}
          />

          <DashboardCard
            title="Risk Management"
            description="Monitor project risks and mitigation strategies"
            href="/client/risks"
            icon={Shield}
            color="orange"
            stats={{ value: stats.activeRisks, label: "Active Risks" }}
          />
        </div> */}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Status and Comments */}
          <div className="lg:col-span-1 space-y-6">
            {/* ✅ NEW: Project Status with Milestone Tracking (NO useState) */}
            <ProjectStatusCard activeProject={activeProject} />
            
            {/* ✅ NEW: Enhanced Comments System (NO useState) */}
            <CommentsNotificationCard />
          </div>

          {/* Right Column - Recent Activities and Completed Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentUpdatesCard updates={recentUpdates} />
              <RecentFilesCard files={recentFiles} />
            </div>
            
            {/* Scrollable Completed Tasks Section - Enhanced */}
            <CompletedTasksCard completedTasks={completedTasks} />

            {/* NEW: Quick Safety & Risk Overview (if there are incidents/risks) */}
            {(recentIncidents.length > 0 || activeRisks.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recentIncidents.length > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Recent Incidents
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {recentIncidents.slice(0, 3).map((incident) => (
                          <div key={incident._id} className="flex items-center gap-2 p-2 bg-white rounded border">
                            <div className={`w-2 h-2 rounded-full ${
                              incident.severity === 'critical' ? 'bg-red-500' :
                              incident.severity === 'high' ? 'bg-orange-500' :
                              incident.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{incident.title}</p>
                              <p className="text-xs text-gray-500">{incident.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link href="/client/incidents">
                        <Button variant="outline" size="sm" className="w-full mt-3">
                          View All Incidents
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {activeRisks.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-orange-600" />
                        Active Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {activeRisks.slice(0, 3).map((risk) => (
                          <div key={risk._id} className="flex items-center gap-2 p-2 bg-white rounded border">
                            <div className={`w-2 h-2 rounded-full ${
                              risk.riskScore >= 15 ? 'bg-red-500' :
                              risk.riskScore >= 10 ? 'bg-orange-500' :
                              risk.riskScore >= 5 ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{risk.riskDescription}</p>
                              <p className="text-xs text-gray-500">{risk.category} • Score: {risk.riskScore}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link href="/client/risks">
                        <Button variant="outline" size="sm" className="w-full mt-3">
                          View Risk Register
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating AI Chatbot - positioned in bottom-right corner */}
      <FloatingAIChatbot className="bottom-6 right-6" />
    </>
  );
}