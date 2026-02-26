import { NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import type { ObjectId } from 'mongodb';
import type { ApiResponse, RecentActivityItem } from '@/types/dashboard';

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  updatedAt: Date;
}

interface FileDocument {
  _id: ObjectId;
  originalName?: string;
  uploadedAt: Date;
  uploadedBy?: ObjectId;
  projectId?: ObjectId;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<RecentActivityItem[]>>({ data: [], error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDatabase();

  // Recent project updates
  const recentProjects = await db
    .collection<ProjectDocument>('projects')
    .find({}, { sort: { updatedAt: -1 }, limit: 5 })
    .toArray();

  // Recent files
  const recentFiles = await db
    .collection<FileDocument>('projectfiles')
    .find({}, { sort: { uploadedAt: -1 }, limit: 5 })
    .toArray();

  const activities: RecentActivityItem[] = [
    ...recentProjects.map((p) => ({
      _id: p._id.toString(),
      type: 'project_update' as const,
      title: p.title,
      description: 'Project updated',
      createdAt: p.updatedAt?.toISOString?.() || new Date().toISOString(),
    })),
    ...recentFiles.map((f) => ({
      _id: f._id.toString(),
      type: 'file_upload' as const,
      title: f.originalName || 'New file',
      description: 'File uploaded',
      createdAt: f.uploadedAt?.toISOString?.() || new Date().toISOString(),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8);

  return NextResponse.json<ApiResponse<RecentActivityItem[]>>({ data: activities });
}


