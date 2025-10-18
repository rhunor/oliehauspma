// src/types/dashboard.ts
// Shared dashboard types for metrics and API responses

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Metric {
  label: string;
  value: number;
  trendPercent?: number; // positive for up, negative for down
  trendDirection?: TrendDirection;
  href?: string;
}

export type ApiResponse<T> = {
  data: T;
  error?: string;
};

export interface RoleDistributionItem {
  role: 'super_admin' | 'project_manager' | 'client';
  count: number;
}

export interface StatusItem {
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  count: number;
}

export interface SystemMetric {
  key: 'cpu' | 'memory' | 'uptime';
  label: string;
  value: number; // percentage for cpu/memory, seconds for uptime
}

export interface RecentActivityItem {
  _id: string;
  type: 'project_update' | 'file_upload' | 'message' | 'notification' | 'project_created';
  title: string;
  description?: string;
  createdAt: string; // ISO
  userName?: string;
  projectId?: string;
}


