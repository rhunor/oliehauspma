// src/app/(dashboard)/admin/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Users,
  FolderOpen,
  TrendingUp,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import FloatingAIChatbot from '@/components/chat/FloatingAIChatbot';

interface AdminStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalUsers: number;
  totalClients: number;
  totalManagers: number;
  totalAdmins: number;
  recentActivities: Array<{
    _id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date;
  }>;
  usersByRole: {
    super_admin: number;
    project_manager: number;
    client: number;
  };
  projectsByStatus: Record<string, number>;
}

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: string;
  progress: number;
  updatedAt: Date;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'user_created': return <Users className="h-4 w-4 text-blue-500" />;
    case 'project_completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'system_alert': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

async function getAdminDashboardData() {
  try {
    const { db } = await connectToDatabase();
    const projects = await db.collection<ProjectDocument>('projects').find({}).toArray();
    const users = await db.collection<UserDocument>('users').find({}).toArray();

    const stats: AdminStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in_progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalUsers: users.length,
      totalClients: users.filter(u => u.role === 'client').length,
      totalManagers: users.filter(u => u.role === 'project_manager').length,
      totalAdmins: users.filter(u => u.role === 'super_admin').length,
      recentActivities: [],
      usersByRole: {
        super_admin: users.filter(u => u.role === 'super_admin').length,
        project_manager: users.filter(u => u.role === 'project_manager').length,
        client: users.filter(u => u.role === 'client').length,
      },
      projectsByStatus: projects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const recentProjectUpdates = projects
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)
      .map(p => ({
        _id: p._id.toString(),
        type: p.status === 'completed' ? 'project_completed' : 'project_updated',
        title: `Project ${p.status === 'completed' ? 'completed' : 'updated'}`,
        description: p.title,
        timestamp: p.updatedAt,
      }));

    const recentUserCreations = users
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3)
      .map(u => ({
        _id: u._id.toString(),
        type: 'user_created',
        title: 'New user registered',
        description: `${u.name} (${u.role})`,
        timestamp: u.createdAt,
      }));

    stats.recentActivities = [...recentProjectUpdates, ...recentUserCreations]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);

    return { stats };
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return {
      stats: {
        totalProjects: 0, activeProjects: 0, completedProjects: 0, totalUsers: 0,
        totalClients: 0, totalManagers: 0, totalAdmins: 0, recentActivities: [],
        usersByRole: { super_admin: 0, project_manager: 0, client: 0 },
        projectsByStatus: {},
      },
    };
  }
}

// Average progress — async server component
async function AverageProgressGauge() {
  const { db } = await connectToDatabase();
  type Doc = { progress?: number };
  const projects = await db.collection<Doc>('projects').find({}, { projection: { progress: 1 } }).toArray();
  const percent = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
    : 0;

  const r = 52;

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* SVG arc gauge like Equa Time Tracker */}
      <div className="relative">
        <svg width="140" height="100" viewBox="0 0 140 100">
          {/* Track */}
          <path
            d={`M 14 88 A ${r} ${r} 0 0 1 126 88`}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Fill — gold */}
          <path
            d={`M 14 88 A ${r} ${r} 0 0 1 126 88`}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * 201} 201`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <p className="text-[36px] font-bold text-white leading-none">{percent}%</p>
        </div>
      </div>
      <div className="w-full space-y-2.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-white/50">Completed</span>
          <span className="font-semibold text-white">
            {projects.filter((p: Doc) => (p.progress || 0) === 100).length}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-white/50">In Progress</span>
          <span className="font-semibold text-white">
            {projects.filter((p: Doc) => (p.progress || 0) > 0 && (p.progress || 0) < 100).length}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-white/50">Not Started</span>
          <span className="font-semibold text-white">
            {projects.filter((p: Doc) => (p.progress || 0) === 0).length}
          </span>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-xl w-56" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 h-40" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl h-60" />
        <div className="bg-gray-900 rounded-2xl h-60" />
      </div>
    </div>
  );
}

async function AdminDashboard() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'super_admin') {
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

  const { stats } = await getAdminDashboardData();

  const firstName = session.user.name?.split(' ')[0] || 'Admin';

  // Bar chart data — capsule bars
  const statusData = [
    { label: 'Active', count: stats.activeProjects, color: '#6B7C3B' },
    { label: 'Planning', count: stats.projectsByStatus['planning'] || 0, color: '#D4AF37' },
    { label: 'On Hold', count: stats.projectsByStatus['on_hold'] || 0, color: '#F97316' },
    { label: 'Done', count: stats.completedProjects, color: '#22C55E' },
  ].filter(d => d.count > 0);
  const maxCount = Math.max(...statusData.map(d => d.count), 1);

  // User role distribution bars
  const roleData = [
    { label: 'Admins', count: stats.usersByRole.super_admin, color: '#6B7C3B' },
    { label: 'Managers', count: stats.usersByRole.project_manager, color: '#D4AF37' },
    { label: 'Clients', count: stats.usersByRole.client, color: '#94A3B8' },
  ];

  return (
    <>
      <div className="space-y-5">

        {/* ── Greeting ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            {/* Equa-style: large display greeting */}
            <h1 className="text-[32px] sm:text-[38px] font-extrabold text-gray-900 leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Hello, {firstName}!
            </h1>
            <p className="text-[14px] text-gray-400 mt-0.5">Here&apos;s your workspace overview</p>
          </div>
        </div>

        {/* ── Row 1: 2 KPI cards (Equa-style: icon square + big number) ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Projects In Progress */}
          <Link href="/admin/projects?status=in_progress" className="block">
            <div className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow duration-200"
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

          {/* Tasks Completed */}
          <Link href="/admin/projects?status=completed" className="block">
            <div className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow duration-200"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: '#6B7C3B' }}>
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] sm:text-[52px] font-extrabold text-gray-900 leading-none"
                  style={{ letterSpacing: '-0.04em' }}>
                  {stats.completedProjects}
                </span>
                <span className="text-[15px] font-medium text-gray-400 pb-1">done</span>
              </div>
              <p className="text-[12px] text-gray-400 mt-1.5 font-medium uppercase tracking-wide">Completed</p>
            </div>
          </Link>
        </div>

        {/* ── Row 2: Analytics card (wide) + Users ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Productivity Trends — Equa-style with capsule bars */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Project Analytics</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Projects by status</p>
              </div>
              <Link href="/admin/projects" className="text-[12px] font-semibold text-gray-400 hover:text-gray-600">
                View all →
              </Link>
            </div>

            {/* Stats inline — like Equa "18h logged this week" */}
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
                <span className="text-[12px] font-medium text-green-600">
                  {stats.totalUsers} team members
                </span>
              </div>
            </div>

            {/* Capsule bar chart — exactly like Equa reference */}
            <div className="flex items-end gap-4 sm:gap-6" style={{ height: '100px' }}>
              {statusData.length > 0 ? statusData.map(item => {
                const barH = Math.max(24, Math.round((item.count / maxCount) * 80));
                const isMax = item.count === maxCount;
                return (
                  <div key={item.label} className="flex flex-col items-center gap-2 flex-1">
                    {isMax && (
                      <div className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: '#111111' }}>
                        {item.count}
                      </div>
                    )}
                    {!isMax && <div className="h-5" />}
                    {/* Capsule — fully rounded like Equa */}
                    <div className="w-full max-w-[44px] rounded-full"
                      style={{ height: `${barH}px`, background: item.color, opacity: 0.9 }} />
                    <span className="text-[11px] text-gray-400 font-medium">{item.label}</span>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-400 self-center mx-auto">No project data yet</p>
              )}
            </div>
          </div>

          {/* Team card */}
          <div className="bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-[15px] font-bold text-gray-900">Team</h2>
            <p className="text-[12px] text-gray-400 mt-0.5 mb-5">User distribution</p>

            {/* Total users — big number like KPI card */}
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-[36px] font-extrabold text-gray-900 leading-none" style={{ letterSpacing: '-0.04em' }}>
                {stats.totalUsers}
              </span>
              <span className="text-[13px] text-gray-400">members</span>
            </div>

            <div className="space-y-3.5">
              {roleData.map(role => (
                <div key={role.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-gray-700">{role.label}</span>
                    <span className="text-[13px] font-bold text-gray-900">{role.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(role.count / Math.max(1, stats.totalUsers) * 100)}%`,
                        background: role.color,
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 3: Activity feed + Project Tracker (dark, like Equa Time Tracker) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Activity — Reminders style */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[15px] font-bold text-gray-900">Recent Activity</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">What&apos;s happening</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-400 mb-5">Latest project updates</p>
            <div className="space-y-2">
              {stats.recentActivities.slice(0, 5).map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{activity.description}</p>
                    <p className="text-[11px] text-gray-400">{activity.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#F5F5F5', color: '#6B7280' }}>
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {stats.recentActivities.length === 0 && (
                <div className="text-center py-10">
                  <Activity className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400">No recent activity yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Tracker — SOLID BLACK like Equa Time Tracker */}
          <div className="rounded-2xl p-6 flex flex-col" style={{ background: '#111111' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Project Tracker</p>
              <h2 className="text-[16px] font-bold text-white mt-1">Overall Progress</h2>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <Suspense fallback={
                <div className="flex items-center justify-center py-10">
                  <div className="w-24 h-24 rounded-full border-4 border-white/10 animate-pulse" />
                </div>
              }>
                <AverageProgressGauge />
              </Suspense>
            </div>

            {/* Bottom quick stats */}
            <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[24px] font-extrabold text-white leading-none">{stats.totalProjects}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Total</p>
              </div>
              <div>
                <p className="text-[24px] font-extrabold text-white leading-none">{stats.totalUsers}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Members</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <Suspense fallback={null}>
        <div className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-[1000]">
          <FloatingAIChatbot />
        </div>
      </Suspense>
    </>
  );
}

export default async function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardLoading />}>
      <AdminDashboard />
    </Suspense>
  );
}
