// src/lib/types/workSchedule.ts - Work Schedule Widget Types
export interface WorkScheduleItem {
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  projectTitle: string;
  phase?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  contractor?: string;
  startDate: string;
  endDate: string;
  estimatedDuration?: string;
  progress: number;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
}

export interface WorkScheduleWidget {
  todayTasks: WorkScheduleItem[];
  upcomingTasks: WorkScheduleItem[];
  totalTasks: number;
  completedToday: number;
  nextMilestone?: {
    title: string;
    dueDate: string;
    daysRemaining: number;
  };
}