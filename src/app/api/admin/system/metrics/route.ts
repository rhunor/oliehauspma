import { NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import type { ApiResponse, SystemMetric } from '@/types/dashboard';
import os from 'os';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<SystemMetric[]>>({ data: [], error: 'Unauthorized' }, { status: 401 });
  }

  const memoryUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const usedMem = memoryUsage.rss;
  const memPercent = Math.min(100, Math.round((usedMem / totalMem) * 100));

  const load = os.loadavg()[0];
  const cpuPercent = Math.max(0, Math.min(100, Math.round((load / os.cpus().length) * 100)));

  const metrics: SystemMetric[] = [
    { key: 'cpu', label: 'CPU', value: cpuPercent },
    { key: 'memory', label: 'Memory', value: memPercent },
    { key: 'uptime', label: 'Uptime', value: Math.round(process.uptime()) },
  ];

  return NextResponse.json<ApiResponse<SystemMetric[]>>({ data: metrics });
}


