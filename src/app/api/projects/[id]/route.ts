// FILE: src/app/api/projects/[id]/route.ts - UPDATED FOR MULTIPLE MANAGERS
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId;
  managers: ObjectId[];
  manager?: ObjectId;
  status: string;
  priority: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress: number;
  siteAddress?: string;
  scopeOfWork?: string;
  designStyle?: string;
  projectDuration?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ✅ UPDATED: Helper function to check access with multiple managers support
async function checkProjectAccess(projectId: string, userId: string, userRole: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  
  if (userRole === 'super_admin') {
    return true;
  }

  const project = await db.collection<ProjectDocument>('projects').findOne({
    _id: new ObjectId(projectId)
  });

  if (!project) {
    return false;
  }

  if (userRole === 'client') {
    return project.client.equals(new ObjectId(userId));
  }

  if (userRole === 'project_manager') {
    // ✅ UPDATED: Check if user is in managers array
    return project.managers.some(managerId => managerId.equals(new ObjectId(userId)));
  }

  return false;
}

// GET /api/projects/[id] - Get single project
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Check access
    const hasAccess = await checkProjectAccess(projectId, session.user.id, session.user.role);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();

    // ✅ UPDATED: Get project with all managers populated
    const project = await db.collection<ProjectDocument>('projects')
      .aggregate([
        { $match: { _id: new ObjectId(projectId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'managers',
            foreignField: '_id',
            as: 'managersData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            managers: '$managersData'
          }
        },
        { $unset: ['clientData', 'managersData'] }
      ])
      .toArray();

    if (!project || project.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project[0]
    });

  } catch (error: unknown) {
    console.error('Error fetching project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Update project - ✅ UPDATED FOR MULTIPLE MANAGERS
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Check access - ✅ Now supports multiple managers
    const hasAccess = await checkProjectAccess(projectId, session.user.id, session.user.role);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const updateData = await request.json();
    const { db } = await connectToDatabase();

    // Build update object
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date()
    };

    // ✅ UPDATED: Handle managerIds as array
    if (updateData.title) updateFields.title = updateData.title;
    if (updateData.description) updateFields.description = updateData.description;
    if (updateData.status) updateFields.status = updateData.status;
    if (updateData.priority) updateFields.priority = updateData.priority;
    if (updateData.siteAddress) updateFields.siteAddress = updateData.siteAddress;
    if (updateData.scopeOfWork) updateFields.scopeOfWork = updateData.scopeOfWork;
    if (updateData.designStyle) updateFields.designStyle = updateData.designStyle;
    if (updateData.projectDuration) updateFields.projectDuration = updateData.projectDuration;
    if (updateData.budget !== undefined) updateFields.budget = updateData.budget;
    if (updateData.progress !== undefined) updateFields.progress = updateData.progress;
    if (updateData.startDate) updateFields.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateFields.endDate = new Date(updateData.endDate);
    if (updateData.tags) updateFields.tags = updateData.tags;
    if (updateData.notes) updateFields.notes = updateData.notes;

    // ✅ NEW: Handle updating managers array (only super_admin can do this)
    if (updateData.managerIds && session.user.role === 'super_admin') {
      const managerIds = updateData.managerIds.map((id: string) => new ObjectId(id));
      
      // Verify all managers exist
      const managers = await db.collection('users').find({
        _id: { $in: managerIds },
        role: 'project_manager',
        isActive: true
      }).toArray();

      if (managers.length !== updateData.managerIds.length) {
        return NextResponse.json(
          { success: false, error: 'One or more managers not found or inactive' },
          { status: 404 }
        );
      }

      updateFields.managers = managerIds;
    }

    // Update project
    const result = await db.collection<ProjectDocument>('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get updated project with populated managers
    const updatedProject = await db.collection<ProjectDocument>('projects')
      .aggregate([
        { $match: { _id: new ObjectId(projectId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'client',
            foreignField: '_id',
            as: 'clientData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'managers',
            foreignField: '_id',
            as: 'managersData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            managers: '$managersData'
          }
        },
        { $unset: ['clientData', 'managersData'] }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: updatedProject[0],
      message: 'Project updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only super admins can delete projects
    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only super admins can delete projects' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const projectId = params.id;

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection<ProjectDocument>('projects').deleteOne({
      _id: new ObjectId(projectId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}