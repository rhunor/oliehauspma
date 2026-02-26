// src/app/api/files/projects/route.ts - FIXED: NO ANY TYPES, PROPER PROJECT RETRIEVAL
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserUploadableProjects } from '@/lib/file-permissions';

// FIXED: Proper interface for API response
interface ProjectsApiResponse {
  success: boolean;
  projects: Array<{
    _id: string;
    title: string;
  }>;
}

interface ErrorResponse {
  success: false;
  error: string;
}

// FIXED: Specific user role types instead of any
type UserRole = 'super_admin' | 'project_manager' | 'client';

// GET /api/files/projects - Get projects user can upload files to
export async function GET(request: NextRequest): Promise<NextResponse<ProjectsApiResponse | ErrorResponse>> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // FIXED: Validate user role is one of the expected types
    const userRole = session.user.role as UserRole;
    if (!['super_admin', 'project_manager', 'client'].includes(userRole)) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid user role' 
      }, { status: 403 });
    }

    // Clients cannot upload files, so return empty array
    if (userRole === 'client') {
      return NextResponse.json({
        success: true,
        projects: []
      });
    }

    // Get uploadable projects for the user
    const projects = await getUserUploadableProjects(session.user.id, userRole);

    return NextResponse.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error('Error fetching uploadable projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 });
  }
}