import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import type { ObjectId } from 'mongodb';
import type { ApiResponse, RoleDistributionItem } from '@/types/dashboard';

interface UserDocument {
  _id: ObjectId;
  role: 'super_admin' | 'project_manager' | 'client';
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json<ApiResponse<RoleDistributionItem[]>>({ data: [], error: 'Unauthorized' }, { status: 401 });
  }
  const { db } = await connectToDatabase();
  const pipeline = [
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { _id: 0, role: '$_id', count: 1 } },
  ];
  const items = await db.collection<UserDocument>('users').aggregate<RoleDistributionItem>(pipeline).toArray();
  return NextResponse.json<ApiResponse<RoleDistributionItem[]>>({ data: items });
}


