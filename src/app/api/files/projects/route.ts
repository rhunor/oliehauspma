// src/app/api/files/projects/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserUploadableProjects } from '@/lib/file-permissions';

// GET /api/files/projects - Get projects user can upload files to
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admin and project managers can upload files
    if (session.user.role === 'client') {
      return NextResponse.json({
        success: true,
        projects: []
      });
    }

    const projects = await getUserUploadableProjects(session.user.id, session.user.role);

    return NextResponse.json({
      success: true,
      projects
    });

  } catch (error: unknown) {
    console.error('Error fetching user projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}