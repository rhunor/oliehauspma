import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import type { ObjectId } from 'mongodb';
import type { ApiResponse, StatusItem } from '@/types/dashboard';

interface ProjectDocument {
  _id: ObjectId;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<StatusItem[]>>({ data: [], error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDatabase();
  const pipeline = [
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ];
  const items = await db.collection<ProjectDocument>('projects').aggregate<StatusItem>(pipeline).toArray();
  return NextResponse.json<ApiResponse<StatusItem[]>>({ data: items });
}


