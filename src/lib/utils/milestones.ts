// src/lib/utils/milestones.ts - Milestone utility functions
import { ObjectId } from 'mongodb';
import type { MilestoneDocument } from '@/lib/types/milestone';

interface DatabaseCollection {
  insertMany: (docs: Omit<MilestoneDocument, '_id'>[]) => Promise<unknown>;
}

interface Database {
  collection: (name: string) => DatabaseCollection;
}

// Initialize project milestones function (called when project is created)
export async function initializeProjectMilestones(
  projectId: string, 
  db: Database
): Promise<void> {
  const milestones: Omit<MilestoneDocument, '_id'>[] = [
    {
      projectId: new ObjectId(projectId),
      phase: 'construction',
      title: 'Construction Phase',
      description: 'Complete all structural and foundational construction work',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      projectId: new ObjectId(projectId),
      phase: 'installation',
      title: 'Installation Phase', 
      description: 'Install all fixtures, utilities, and essential systems',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      projectId: new ObjectId(projectId),
      phase: 'styling',
      title: 'Set up and Styling Phase',
      description: 'Complete interior design, styling, and final setup',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  try {
    await db.collection('milestones').insertMany(milestones);
    console.log(`Initialized milestones for project ${projectId}`);
  } catch (error) {
    console.error('Error initializing project milestones:', error);
    throw new Error('Failed to initialize project milestones');
  }
}

// Helper function to get milestone progress
export function calculateMilestoneProgress(milestones: MilestoneDocument[]) {
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const totalCount = 3; // Always 3 phases
  const percentage = Math.round((completedCount / totalCount) * 100);
  
  return {
    completed: completedCount,
    total: totalCount,
    percentage
  };
}

// Helper function to validate milestone phase
export function isValidMilestonePhase(phase: string): phase is 'construction' | 'installation' | 'styling' {
  return ['construction', 'installation', 'styling'].includes(phase);
}

// Helper function to transform milestone for API response
export function transformMilestoneForResponse(milestone: MilestoneDocument) {
  return {
    _id: milestone._id?.toString(),
    projectId: milestone.projectId.toString(),
    phase: milestone.phase,
    title: milestone.title,
    description: milestone.description,
    status: milestone.status,
    completedDate: milestone.completedDate?.toISOString(),
    completedBy: milestone.completedBy?.toString(),
    notes: milestone.notes,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString()
  };
}