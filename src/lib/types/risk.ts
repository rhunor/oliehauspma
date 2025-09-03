// src/lib/types/risk.ts - Risk Register Types
export interface RiskRegisterItem {
  _id: string;
  projectId: string;
  riskCode?: string;
  riskDescription: string;
  category: 'technical' | 'financial' | 'schedule' | 'safety' | 'quality' | 'environmental' | 'legal' | 'operational';
  probability: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number; // Calculated: probability * impact
  triggers?: string[];
  mitigationStrategy: string;
  contingencyPlan?: string;
  owner: string;
  ownerName: string;
  status: 'identified' | 'assessed' | 'mitigated' | 'transferred' | 'accepted' | 'closed';
  reviewDate?: string;
  lastReviewDate?: string;
  residualProbability?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualImpact?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  residualScore?: number;
  actionItems?: Array<{
    action: string;
    assignedTo: string;
    dueDate: string;
    status: 'pending' | 'in_progress' | 'completed';
    completedDate?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
