// FILE: src/app/api/projects/route.ts - UPDATED FOR MULTIPLE MANAGERS
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

interface ProjectDocument {
  _id: ObjectId;
  title: string;
  description: string;
  client: ObjectId;
  managers: ObjectId[];
  manager?: ObjectId;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectDocumentWithId extends ProjectDocument {
  _id: ObjectId;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
}

interface ProjectWithUsers extends Omit<ProjectDocument, 'client' | 'managers'> {
  client: UserDocument;
  managers: UserDocument[];
}

interface CreateProjectData {
  title: string;
  description: string;
  clientId: string;
  managerIds: string[];
  status?: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string;
  endDate?: string;
  budget?: number;
  tags?: string[];
  notes?: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as ProjectDocument['status'] | null;
    const priority = searchParams.get('priority') as ProjectDocument['priority'] | null;
    const search = searchParams.get('search') || '';

    const { db } = await connectToDatabase();
    
    // Build filter based on user role with proper typing - ✅ UPDATED FOR MULTIPLE MANAGERS
    const filter: Filter<ProjectDocumentWithId> = {};
    
    // Role-based access control
    if (session.user.role === 'client') {
      filter.client = new ObjectId(session.user.id);
    } else if (session.user.role === 'project_manager') {
      // ✅ UPDATED: Check if user is in managers array
      filter.managers = new ObjectId(session.user.id);
    }
    // super_admin can see all projects - no additional filter needed

    // Add additional filters with proper type casting
    if (status && ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'].includes(status)) {
      filter.status = status;
    }
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      filter.priority = priority;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await db.collection<ProjectDocumentWithId>('projects').countDocuments(filter);

    // ✅ UPDATED: Get projects with populated user data including all managers
    const projects = await db.collection<ProjectDocumentWithId>('projects')
      .aggregate<ProjectWithUsers>([
        { $match: filter },
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
        { $unset: ['clientData', 'managersData'] },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project - ✅ UPDATED FOR MULTIPLE MANAGERS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Only super admins can create projects
    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Only super admins can create projects' 
        },
        { status: 403 }
      );
    }

    const projectData: CreateProjectData = await request.json();

    // Validate required fields
    if (!projectData.title || !projectData.description || !projectData.clientId || !projectData.managerIds || projectData.managerIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Title, description, client, and at least one manager are required'
        },
        { status: 400 }
      );
    }

    // Validate all ObjectIds
    if (!ObjectId.isValid(projectData.clientId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid client ID' },
        { status: 400 }
      );
    }

    for (const managerId of projectData.managerIds) {
      if (!ObjectId.isValid(managerId)) {
        return NextResponse.json(
          { success: false, error: `Invalid manager ID: ${managerId}` },
          { status: 400 }
        );
      }
    }

    const { db } = await connectToDatabase();

    // Verify client exists and is active
    const client = await db.collection('users').findOne({
      _id: new ObjectId(projectData.clientId),
      role: 'client',
      isActive: true
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found or inactive' },
        { status: 404 }
      );
    }

    // ✅ NEW: Verify all managers exist and are active
    const managerObjectIds = projectData.managerIds.map(id => new ObjectId(id));
    const managers = await db.collection('users').find({
      _id: { $in: managerObjectIds },
      role: 'project_manager',
      isActive: true
    }).toArray();

    if (managers.length !== projectData.managerIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more managers not found or inactive' },
        { status: 404 }
      );
    }

    // Create project document - ✅ UPDATED WITH MANAGERS ARRAY
    const newProject = {
      title: projectData.title,
      description: projectData.description,
      client: new ObjectId(projectData.clientId),
      managers: managerObjectIds,
      status: projectData.status || 'planning',
      priority: projectData.priority || 'medium',
      startDate: projectData.startDate ? new Date(projectData.startDate) : undefined,
      endDate: projectData.endDate ? new Date(projectData.endDate) : undefined,
      budget: projectData.budget,
      progress: 0,
      tags: projectData.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('projects').insertOne(newProject);

    // ✅ UPDATED: Create notifications for client and ALL managers
    const notifications = [
      {
        recipientId: new ObjectId(projectData.clientId),
        senderId: new ObjectId(session.user.id),
        type: 'project_created',
        title: 'New Project Assigned',
        message: `You have been assigned to project: ${projectData.title}`,
        data: { projectId: result.insertedId.toString() },
        isRead: false,
        priority: 'medium',
        category: 'info',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ...managerObjectIds.map(managerId => ({
        recipientId: managerId,
        senderId: new ObjectId(session.user.id),
        type: 'project_created',
        title: 'New Project Assignment',
        message: `You have been assigned as manager for: ${projectData.title}`,
        data: { projectId: result.insertedId.toString() },
        isRead: false,
        priority: 'medium',
        category: 'info',
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    ];

    await db.collection('notifications').insertMany(notifications);

    // Return the created project with populated user data
    const createdProject = await db.collection<ProjectDocumentWithId>('projects')
      .aggregate<ProjectWithUsers>([
        { $match: { _id: result.insertedId } },
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
      data: createdProject[0],
      message: 'Project created successfully',
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}