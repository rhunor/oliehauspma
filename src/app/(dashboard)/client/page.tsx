// src/app/(dashboard)/client/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileText,
  MessageSquare,
  FolderOpen,
  Target,
  TrendingUp,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  recentMessages: number;
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
}

interface RecentFile {
  _id: string;
  originalName: string;
  projectTitle: string;
  createdAt: string;
}

interface WorkScheduleWidget {
  todayTasks: WorkScheduleItem[];
  upcomingTasks: WorkScheduleItem[];
  totalTasks: number;
  completedToday: number;
}

interface WorkScheduleItem {
  _id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  startDate: string;
  contractor?: string;
  projectTitle: string;
}

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

async function getMilestoneProgress(projectId: string): Promise<MilestoneProgress> {
  try {
    const { db } = await connectToDatabase();
    const milestones = await db.collection<MilestoneDocument>('milestones')
      .find({ projectId: new ObjectId(projectId) }).sort({ createdAt: 1 }).toArray();
    const completed = milestones.filter(m => m.status === 'completed');
    const next = milestones.find(m => m.status !== 'completed');
    return {
      currentPhase: completed.length + 1,
      totalPhases: 3,
      completedMilestones: completed.map(m => ({
        _id: m._id!.toString(), projectId: m.projectId.toString(), phase: m.phase,
        title: m.title, description: m.description, status: m.status,
        completedDate: m.completedDate?.toISOString(), completedBy: m.completedBy?.toString(),
        notes: m.notes, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
      })),
      nextMilestone: next ? {
        _id: next._id!.toString(), projectId: next.projectId.toString(), phase: next.phase,
        title: next.title, description: next.description, status: next.status,
        completedDate: next.completedDate?.toISOString(), completedBy: next.completedBy?.toString(),
        notes: next.notes, createdAt: next.createdAt.toISOString(), updatedAt: next.updatedAt.toISOString(),
      } : undefined,
      overallProgress: Math.round((completed.length / 3) * 100),
    };
  } catch {
    return { currentPhase: 1, totalPhases: 3, completedMilestones: [], overallProgress: 0 };
  }
}

async function getWorkScheduleData(clientId: string): Promise<WorkScheduleWidget> {
  try {
    const { db } = await connectToDatabase();
    const projects = await db.collection('projects')
      .find({ client: new ObjectId(clientId) }).project({ _id: 1, title: 1 }).toArray();
    const projectIds = projects.map(p => p._id);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayTasks = await db.collection('dailyActivities')
      .find({ projectId: { $in: projectIds }, plannedDate: { $gte: todayStart, $lt: todayEnd } })
      .limit(3).toArray();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = await db.collection('dailyActivities')
      .find({ projectId: { $in: projectIds }, plannedDate: { $gt: todayEnd, $lte: weekFromNow }, status: { $ne: 'completed' } })
      .sort({ plannedDate: 1 }).limit(5).toArray();
    const transform = (task: Record<string, unknown>): WorkScheduleItem => {
      const project = projects.find(p => p._id.equals(task.projectId as ObjectId));
      return {
        _id: (task._id as ObjectId).toString(), title: task.title as string,
        status: task.status as WorkScheduleItem['status'],
        startDate: task.plannedDate ? (task.plannedDate as Date).toISOString() : new Date().toISOString(),
        contractor: task.contractor as string, projectTitle: project?.title || 'Unknown',
      };
    };
    return {
      todayTasks: todayTasks.map(transform), upcomingTasks: upcomingTasks.map(transform),
      totalTasks: todayTasks.length + upcomingTasks.length,
      completedToday: todayTasks.filter(t => t.status === 'completed').length,
    };
  } catch {
    return { todayTasks: [], upcomingTasks: [], totalTasks: 0, completedToday: 0 };
  }
}

async function getClientDashboardData(clientId: string) {
  try {
    const { db } = await connectToDatabase();
    const projectQuery: Filter<ProjectDocument> = { client: new ObjectId(clientId) };
    const projects = await db.collection<ProjectDocument>('projects').find(projectQuery).toArray();
    const projectIds = projects.map(p => p._id);

    const stats: ClientStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      recentMessages: 0,
    };

    let activeProject: ActiveProject | null = null;
    const current = projects.filter(p => p.status === 'in_progress')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (current) {
      const milestoneProgress = await getMilestoneProgress(current._id.toString());
      activeProject = {
        _id: current._id.toString(), title: current.title, description: current.description,
        status: current.status, priority: current.priority, progress: current.progress,
        milestoneProgress,
      };
    }

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const recentUpdates: RecentUpdate[] = projects
      .filter(p => p.updatedAt >= startOfMonth)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map(p => ({
        _id: p._id.toString(),
        type: p.status === 'completed' ? 'project_completed' : 'project_updated',
        title: `Project ${p.status === 'completed' ? 'completed' : 'updated'}`,
        description: p.title,
        timestamp: p.updatedAt.toISOString(),
      }));

    const recentFilesDocs = await db.collection('files')
      .find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(5).toArray();
    const recentFiles: RecentFile[] = recentFilesDocs.map(f => ({
      _id: f._id.toString(), originalName: f.originalName,
      projectTitle: projects.find(p => p._id.equals(f.projectId))?.title || 'Unknown',
      createdAt: f.createdAt.toISOString(),
    }));

    const workSchedule = await getWorkScheduleData(clientId);

    const recentIncidents = await db.collection('incidents')
      .find({ projectId: { $in: projectIds } }).sort({ reportedDate: -1 }).limit(3).toArray();
    const activeRisks = await db.collection('risks')
      .find({ projectId: { $in: projectIds }, status: { $ne: 'resolved' } }).limit(3).toArray();

    return { stats, activeProject, recentUpdates, recentFiles, workSchedule, recentIncidents: recentIncidents.length, activeRisks: activeRisks.length };
  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    return {
      stats: { totalProjects: 0, activeProjects: 0, completedProjects: 0, recentMessages: 0 },
      activeProject: null, recentUpdates: [], recentFiles: [],
      workSchedule: { todayTasks: [], upcomingTasks: [], totalTasks: 0, completedToday: 0 },
      recentIncidents: 0, activeRisks: 0,
    };
  }
}

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== 'client') redirect('/login');

  const {
    stats, activeProject, recentUpdates, recentFiles, workSchedule, recentIncidents, activeRisks
  } = await getClientDashboardData(session.user.id);

  const firstName = session.user.name?.split(' ')[0] || 'Client';
  const percent = activeProject?.progress ?? 0;

  return (
    <>
      <div className="space-y-5">

        {/* ── Greeting — Equa style ── */}
        <div>
          <h1 className="text-[32px] sm:text-[38px] font-extrabold text-gray-900 leading-tight"
            style={{ letterSpacing: '-0.03em' }}>
            Hello, {firstName}!
          </h1>
          <p className="text-[14px] text-gray-400 mt-0.5">Here&apos;s your project overview</p>
        </div>

        {/* ── Row 1: 2 KPI cards ── */}
        <div className="grid grid-cols-2 gap-4">

          <Link href="/client/projects?status=in_progress" className="block">
            <div className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: '#111111' }}>
                <FolderOpen className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] sm:text-[52px] font-extrabold text-gray-900 leading-none"
                  style={{ letterSpacing: '-0.04em' }}>
                  {stats.activeProjects}
                </span>
                <span className="text-[15px] font-medium text-gray-400 pb-1">projects</span>
              </div>
              <p className="text-[12px] text-gray-400 mt-1.5 font-medium uppercase tracking-wide">In Progress</p>
            </div>
          </Link>

          <Link href="/client/site-schedule" className="block">
            <div className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: '#6B7C3B' }}>
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] sm:text-[52px] font-extrabold text-gray-900 leading-none"
                  style={{ letterSpacing: '-0.04em' }}>
                  {workSchedule.totalTasks}
                </span>
                <span className="text-[15px] font-medium text-gray-400 pb-1">tasks</span>
              </div>
              <p className="text-[12px] text-gray-400 mt-1.5 font-medium uppercase tracking-wide">Scheduled</p>
            </div>
          </Link>
        </div>

        {/* ── Row 2: Project status tracker (dark) + Recent updates ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Project Tracker — SOLID BLACK like Equa Time Tracker */}
          <div className="rounded-2xl p-6 flex flex-col" style={{ background: '#111111' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Site Progress</p>
              <h2 className="text-[16px] font-bold text-white mt-1">
                {activeProject ? activeProject.title : 'No active project'}
              </h2>
            </div>

            {/* Arc gauge */}
            <div className="flex items-center justify-center mt-4">
              <div className="relative">
                <svg width="140" height="100" viewBox="0 0 140 100">
                  <path d="M 14 88 A 52 52 0 0 1 126 88" fill="none"
                    stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 14 88 A 52 52 0 0 1 126 88" fill="none"
                    stroke="#D4AF37" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(percent / 100) * 201} 201`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <p className="text-[34px] font-extrabold text-white leading-none">{percent}%</p>
                </div>
              </div>
            </div>

            {activeProject && (
              <div className="mt-4 space-y-2.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-white/50">Phase</span>
                  <span className="font-semibold text-white">
                    {activeProject.milestoneProgress.currentPhase} of {activeProject.milestoneProgress.totalPhases}
                  </span>
                </div>
                {activeProject.milestoneProgress.nextMilestone && (
                  <div className="flex justify-between text-[12px] gap-2">
                    <span className="text-white/50 shrink-0">Next</span>
                    <span className="font-medium text-white text-right truncate">
                      {activeProject.milestoneProgress.nextMilestone.title}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[22px] font-extrabold text-white leading-none">{stats.totalProjects}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Total</p>
              </div>
              <div>
                <p className="text-[22px] font-extrabold text-white leading-none">{stats.completedProjects}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Done</p>
              </div>
            </div>
          </div>

          {/* Recent Updates — Reminders style */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[15px] font-bold text-gray-900">Recent Updates</h2>
              <span className="text-[11px] text-gray-400">What&apos;s happening</span>
            </div>
            <p className="text-[12px] text-gray-400 mb-5">Latest project activity</p>
            <div className="space-y-1.5">
              {recentUpdates.slice(0, 5).map((update, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    {update.type === 'project_completed'
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <Activity className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{update.description}</p>
                    <p className="text-[11px] text-gray-400">{update.title}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: '#F5F5F5', color: '#6B7280' }}>
                    {formatTimeAgo(new Date(update.timestamp))}
                  </span>
                </div>
              ))}
              {recentUpdates.length === 0 && (
                <div className="text-center py-10">
                  <Activity className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No recent updates</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Recent Files + Quick links ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Files */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[15px] font-bold text-gray-900">Recent Files</h2>
              <Link href="/client/files" className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">View all →</Link>
            </div>
            <p className="text-[12px] text-gray-400 mb-5">Latest project documents</p>
            <div className="space-y-1.5">
              {recentFiles.slice(0, 4).map(file => (
                <div key={file._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{file.originalName}</p>
                    <p className="text-[11px] text-gray-400">{file.projectTitle}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: '#F5F5F5', color: '#6B7280' }}>
                    {formatTimeAgo(new Date(file.createdAt))}
                  </span>
                </div>
              ))}
              {recentFiles.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No files yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Access */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-[15px] font-bold text-gray-900">Quick Access</h2>
            <p className="text-[12px] text-gray-400 mt-0.5 mb-5">Your key sections</p>
            <div className="space-y-1.5">
              {[
                { href: '/client/daily-reports', Icon: TrendingUp, label: 'Daily Reports', sub: 'Project updates' },
                { href: '/client/messages', Icon: MessageSquare, label: 'Messages', sub: 'Team chat' },
                { href: '/client/incidents', Icon: AlertTriangle, label: 'Incidents', sub: `${recentIncidents} reported` },
                { href: '/client/projects', Icon: Target, label: 'All Projects', sub: `${stats.totalProjects} total` },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <item.Icon className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.sub}</p>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </Link>
              ))}
            </div>

            {/* Alert strip when incidents/risks exist */}
            {(recentIncidents > 0 || activeRisks > 0) && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl"
                style={{ background: '#FEF2F2' }}>
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <p className="text-[11px] font-medium text-red-600">
                  {recentIncidents > 0 && `${recentIncidents} incident${recentIncidents > 1 ? 's' : ''}`}
                  {recentIncidents > 0 && activeRisks > 0 && ', '}
                  {activeRisks > 0 && `${activeRisks} risk${activeRisks > 1 ? 's' : ''}`} need attention
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      <Suspense fallback={null}>
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 2147483647, pointerEvents: 'auto' }}>
          <FloatingAIChatbot />
        </div>
      </Suspense>
    </>
  );
}
