// src/app/(dashboard)/manager/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  CheckCircle,
  AlertTriangle,
  FileText,
  MessageSquare,
  FolderOpen,
  TrendingUp,
} from 'lucide-react';

import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

interface ManagerStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProgress: number;
  clientCount: number;
  recentMessages: number;
}

interface ProjectSummary {
  _id: string;
  title: string;
  status: string;
  progress: number;
  clientName: string;
  updatedAt: string;
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

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: string;
  progress: number;
  client: ObjectId;
  manager: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
}

async function getManagerDashboardData(managerId: string) {
  try {
    const { db } = await connectToDatabase();

    const projectQuery: Filter<ProjectDocument> = { manager: new ObjectId(managerId) };
    const projects = await db.collection<ProjectDocument>('projects').find(projectQuery).toArray();
    const projectIds = projects.map(p => p._id);

    const stats: ManagerStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      averageProgress: projects.length > 0
        ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0,
      clientCount: new Set(projects.map(p => p.client.toString())).size,
      recentMessages: 0,
    };

    const recentProjects: ProjectSummary[] = [];
    for (const project of projects.slice(0, 6)) {
      const client = await db.collection<UserDocument>('users').findOne({ _id: project.client });
      recentProjects.push({
        _id: project._id.toString(),
        title: project.title,
        status: project.status,
        progress: project.progress,
        clientName: client?.name || 'Unknown',
        updatedAt: project.updatedAt.toISOString(),
      });
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

    const recentFiles = await db.collection('files')
      .find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 }).limit(5).toArray();

    const transformedFiles: RecentFile[] = recentFiles.map(f => ({
      _id: f._id.toString(),
      originalName: f.originalName,
      projectTitle: projects.find(p => p._id.equals(f.projectId))?.title || 'Unknown',
      createdAt: f.createdAt.toISOString(),
    }));

    return { stats, recentProjects, recentUpdates, recentFiles: transformedFiles };
  } catch (error) {
    console.error('Error fetching manager dashboard data:', error);
    return {
      stats: { totalProjects: 0, activeProjects: 0, completedProjects: 0, averageProgress: 0, clientCount: 0, recentMessages: 0 },
      recentProjects: [],
      recentUpdates: [],
      recentFiles: [],
    };
  }
}

function ManagerDashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-xl w-56" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-40" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl h-60" />
        <div className="bg-gray-900 rounded-2xl h-60" />
      </div>
    </div>
  );
}

async function ManagerDashboard() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'project_manager') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const { stats, recentProjects, recentFiles } = await getManagerDashboardData(session.user.id);

  const firstName = session.user.name?.split(' ')[0] || 'Manager';

  // Capsule bar chart data
  const barData = [
    { label: 'Active', count: stats.activeProjects, color: '#6B7C3B' },
    { label: 'Planning', count: Math.max(0, stats.totalProjects - stats.activeProjects - stats.completedProjects), color: '#D4AF37' },
    { label: 'Done', count: stats.completedProjects, color: '#22C55E' },
  ].filter(d => d.count > 0);
  const maxCount = Math.max(...barData.map(d => d.count), 1);

  return (
    <>
      <div className="space-y-5">

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-[32px] sm:text-[38px] font-extrabold text-gray-900 leading-tight"
            style={{ letterSpacing: '-0.03em' }}>
            Hello, {firstName}!
          </h1>
          <p className="text-[14px] text-gray-400 mt-0.5">Here&apos;s your weekly overview</p>
        </div>

        {/* ── Row 1: 2 KPI cards ── */}
        <div className="grid grid-cols-2 gap-4">

          <Link href="/manager/projects?status=in_progress" className="block">
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

          <Link href="/manager/projects?status=completed" className="block">
            <div className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: '#6B7C3B' }}>
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] sm:text-[52px] font-extrabold text-gray-900 leading-none"
                  style={{ letterSpacing: '-0.04em' }}>
                  {stats.averageProgress}%
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-1.5 font-medium uppercase tracking-wide">Avg Progress</p>
            </div>
          </Link>
        </div>

        {/* ── Row 2: Analytics (wide) + Quick links ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Analytics — capsule bar chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Project Trends</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Projects by current status</p>
              </div>
              <Link href="/manager/projects" className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">
                View all →
              </Link>
            </div>
            <div className="mt-4 mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[38px] font-extrabold text-gray-900 leading-none"
                  style={{ letterSpacing: '-0.04em' }}>
                  {stats.totalProjects}
                </span>
                <span className="text-[14px] text-gray-400">total projects</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[12px] font-medium text-green-600">{stats.clientCount} active clients</span>
              </div>
            </div>

            {/* Capsule bars */}
            <div className="flex items-end gap-4 sm:gap-8" style={{ height: '100px' }}>
              {barData.length > 0 ? barData.map(item => {
                const barH = Math.max(24, Math.round((item.count / maxCount) * 80));
                const isMax = item.count === maxCount;
                return (
                  <div key={item.label} className="flex flex-col items-center gap-2 flex-1">
                    {isMax
                      ? <div className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#111' }}>{item.count}</div>
                      : <div className="h-5" />}
                    <div className="w-full max-w-[48px] rounded-full"
                      style={{ height: `${barH}px`, background: item.color, opacity: 0.9 }} />
                    <span className="text-[11px] text-gray-400 font-medium">{item.label}</span>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-400 self-center mx-auto">No projects yet</p>
              )}
            </div>
          </div>

          {/* Quick Access */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-[15px] font-bold text-gray-900">Quick Access</h2>
            <p className="text-[12px] text-gray-400 mt-0.5 mb-5">Navigate to key sections</p>
            <div className="space-y-1.5">
              {[
                { href: '/manager/site-schedule', Icon: Calendar, label: 'Site Schedule', sub: 'View timeline' },
                { href: '/manager/files', Icon: FileText, label: 'Project Files', sub: `${recentFiles.length} recent` },
                { href: '/manager/messages', Icon: MessageSquare, label: 'Messages', sub: 'Team chat' },
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
          </div>
        </div>

        {/* ── Row 3: Recent Projects + Tracker (dark) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Projects — Reminders-style */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[15px] font-bold text-gray-900">Recent Projects</h2>
              <span className="text-[11px] text-gray-400">What&apos;s in progress</span>
            </div>
            <p className="text-[12px] text-gray-400 mb-5">Your latest assignments</p>
            <div className="space-y-1.5">
              {recentProjects.length > 0 ? recentProjects.slice(0, 5).map(project => {
                const statusColor = project.status === 'completed' ? '#22C55E'
                  : project.status === 'in_progress' ? '#6B7C3B'
                  : project.status === 'planning' ? '#D4AF37' : '#94A3B8';
                const statusLabel = project.status === 'in_progress' ? 'Active'
                  : project.status === 'completed' ? 'Done'
                  : project.status === 'planning' ? 'Planning' : 'Hold';
                return (
                  <Link key={project._id} href={`/manager/projects/${project._id}`} className="block">
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${statusColor}15` }}>
                        <FolderOpen className="h-4 w-4" style={{ color: statusColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{project.title}</p>
                        <p className="text-[11px] text-gray-400">{project.clientName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${statusColor}15`, color: statusColor }}>
                          {statusLabel}
                        </span>
                        <p className="text-[11px] text-gray-400 mt-1">{project.progress}%</p>
                      </div>
                    </div>
                  </Link>
                );
              }) : (
                <div className="text-center py-10">
                  <FolderOpen className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No projects yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio Tracker — SOLID BLACK like Equa Time Tracker */}
          <div className="rounded-2xl p-6" style={{ background: '#111111' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Portfolio</p>
            <h2 className="text-[16px] font-bold text-white mt-1 mb-6">Progress</h2>

            {/* Arc gauge */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg width="140" height="100" viewBox="0 0 140 100">
                  <path d="M 14 88 A 52 52 0 0 1 126 88" fill="none"
                    stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 14 88 A 52 52 0 0 1 126 88" fill="none"
                    stroke="#D4AF37" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(stats.averageProgress / 100) * 201} 201`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <p className="text-[34px] font-extrabold text-white leading-none">{stats.averageProgress}%</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-white/50">Active</span>
                <span className="font-bold text-white">{stats.activeProjects}</span>
              </div>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-white/50">Completed</span>
                <span className="font-bold text-white">{stats.completedProjects}</span>
              </div>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-white/50">Clients</span>
                <span className="font-bold text-white">{stats.clientCount}</span>
              </div>
            </div>

            <Link href="/manager/projects"
              className="mt-5 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}>
              <Activity className="h-3.5 w-3.5" />
              View Projects
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {stats.totalProjects === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">No projects yet</h3>
            <p className="text-[13px] text-gray-400 mb-5">Create your first project to get started.</p>
            <Link href="/manager/projects/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold text-white"
              style={{ background: '#111111' }}>
              Create Project
            </Link>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <div className="fixed bottom-4 right-4 z-[1000]">
          <FloatingAIChatbot />
        </div>
      </Suspense>
    </>
  );
}

export default async function ManagerDashboardPage() {
  return (
    <Suspense fallback={<ManagerDashboardLoading />}>
      <ManagerDashboard />
    </Suspense>
  );
}
