// src/lib/types/incident.ts - Incident Report Types
import type { ObjectId } from 'mongodb';

export interface IncidentReport {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  category: 'safety' | 'equipment' | 'environmental' | 'security' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  dateOccurred: string;
  timeOccurred?: string;
  reportedBy: string;
  reportedByName: string;
  witnessNames?: string[];
  injuryDetails?: {
    injuryType: 'none' | 'minor' | 'major' | 'fatality';
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved?: string[];
  weatherConditions?: string;
  immediateActions?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  photos?: string[];
  documents?: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

// MongoDB Document Interface for Backend
export interface IncidentReportDocument {
  _id?: ObjectId;
  projectId: ObjectId;
  title: string;
  description: string;
  category: 'safety' | 'equipment' | 'environmental' | 'security' | 'quality' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  dateOccurred: Date;
  timeOccurred?: string;
  reportedBy: ObjectId;
  witnessNames?: string[];
  injuryDetails?: {
    injuryType: 'none' | 'minor' | 'major' | 'fatality';
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved?: string[];
  weatherConditions?: string;
  immediateActions?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: ObjectId;
  photos?: string[];
  documents?: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to transform MongoDB document to client-safe format
export function transformIncidentReport(doc: IncidentReportDocument, reportedByName?: string): IncidentReport {
  return {
    _id: doc._id?.toString() || '',
    projectId: doc.projectId.toString(),
    title: doc.title,
    description: doc.description,
    category: doc.category,
    severity: doc.severity,
    location: doc.location,
    dateOccurred: doc.dateOccurred.toISOString(),
    timeOccurred: doc.timeOccurred,
    reportedBy: doc.reportedBy.toString(),
    reportedByName: reportedByName || 'Unknown',
    witnessNames: doc.witnessNames,
    injuryDetails: doc.injuryDetails,
    equipmentInvolved: doc.equipmentInvolved,
    weatherConditions: doc.weatherConditions,
    immediateActions: doc.immediateActions,
    rootCause: doc.rootCause,
    correctiveActions: doc.correctiveActions,
    preventiveActions: doc.preventiveActions,
    status: doc.status,
    priority: doc.priority,
    assignedTo: doc.assignedTo?.toString(),
    photos: doc.photos || [],
    documents: doc.documents || [],
    followUpRequired: doc.followUpRequired,
    followUpDate: doc.followUpDate?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

// Constants
export const INCIDENT_CATEGORIES = [
  'safety',
  'equipment', 
  'environmental',
  'security',
  'quality',
  'other'
] as const;

export const INCIDENT_SEVERITIES = [
  'low',
  'medium', 
  'high',
  'critical'
] as const;

export const INCIDENT_STATUSES = [
  'open',
  'investigating',
  'resolved', 
  'closed'
] as const;

export const INJURY_TYPES = [
  'none',
  'minor',
  'major',
  'fatality'
] as const;

export const INCIDENT_PRIORITIES = [
  'low',
  'medium',
  'high', 
  'urgent'
] as const;

export const INCIDENT_CATEGORY_NAMES: Record<string, string> = {
  safety: 'Safety Incident',
  equipment: 'Equipment Failure',
  environmental: 'Environmental Issue',
  security: 'Security Breach',
  quality: 'Quality Issue',
  other: 'Other Incident'
};

export const INCIDENT_SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800', 
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800'
};