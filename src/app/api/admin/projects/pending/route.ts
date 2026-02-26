import { NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import type { ObjectId } from 'mongodb';
import type { ApiResponse } from '@/types/dashboard';

interface ProjectDocument {
  _id: ObjectId;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<{ total: number }>>({ data: { total: 0 }, error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDatabase();
  const total = await db.collection<ProjectDocument>('projects').countDocuments({ status: 'planning' });
  return NextResponse.json<ApiResponse<{ total: number }>>({ data: { total } });
}


