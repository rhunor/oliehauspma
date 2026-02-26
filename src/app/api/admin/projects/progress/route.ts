import { NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import type { ObjectId } from 'mongodb';
import type { ApiResponse } from '@/types/dashboard';

interface ProjectDocument {
  _id: ObjectId;
  progress: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<{ percent: number }>>({ data: { percent: 0 }, error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDatabase();
  const projects = await db.collection<ProjectDocument>('projects').find({}).project({ progress: 1 }).toArray();
  const percent = projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length) : 0;
  return NextResponse.json<ApiResponse<{ percent: number }>>({ data: { percent } });
}


