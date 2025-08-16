// src/app/api/projects/route.ts - COMPLETE WITH DASHBOARD COMPATIBILITY FIX
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createProjectSchema } from '@/lib/validation';
import { ObjectId, Filter, OptionalId } from 'mongodb';

// Define the MongoDB document structure - without _id for insertion
interface ProjectDocument {
  title: string;
  description: string;
  client: ObjectId;
  manager: ObjectId;
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

// Define the complete document structure with _id
interface ProjectDocumentWithId extends ProjectDocument {
  _id: ObjectId;
}

// Define the user document structure
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

// Define the aggregated result structure
interface ProjectWithUsers {
  _id: ObjectId;
  title: string;
  description: string;
  client: UserDocument;
  manager: UserDocument;
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

// Define the create project schema type
interface CreateProjectData {
  title: string;
  description: string;
  clientId: string;
  managerId: string;
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
    
    // Build filter based on user role with proper typing
    const filter: Filter<ProjectDocumentWithId> = {};
    
    // Role-based access control
    if (session.user.role === 'client') {
      filter.client = new ObjectId(session.user.id);
    } else if (session.user.role === 'project_manager') {
      filter.manager = new ObjectId(session.user.id);
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

    // Get projects with populated user data
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
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ])
      .toArray();

    const totalPages = Math.ceil(total / limit);

    // DASHBOARD COMPATIBILITY FIX: Return both nested and direct structures
    return NextResponse.json({
      success: true,
      data: {
        data: projects, // Nested structure for dashboard compatibility
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      // Also include direct access for backward compatibility
      projects: projects
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

    // Only super_admin can create projects
    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Only super admins can create projects' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = createProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation failed',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        },
        { status: 400 }
      );
    }

    const projectData: CreateProjectData = validation.data;
    const { db } = await connectToDatabase();

    // Verify client and manager exist and have correct roles
    const [client, manager] = await Promise.all([
      db.collection<UserDocument>('users').findOne({ 
        _id: new ObjectId(projectData.clientId),
        role: 'client',
        isActive: true
      }),
      db.collection<UserDocument>('users').findOne({ 
        _id: new ObjectId(projectData.managerId),
        role: 'project_manager',
        isActive: true
      })
    ]);

    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Client not found or inactive' 
        },
        { status: 400 }
      );
    }

    if (!manager) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Project manager not found or inactive' 
        },
        { status: 400 }
      );
    }

    // Create project using OptionalId for proper typing
    const newProject: OptionalId<ProjectDocument> = {
      title: projectData.title,
      description: projectData.description,
      client: new ObjectId(projectData.clientId),
      manager: new ObjectId(projectData.managerId),
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

    const result = await db.collection<ProjectDocument>('projects').insertOne(newProject);

    // Create notifications for client and manager
    const notifications = [
      {
        recipient: new ObjectId(projectData.clientId),
        sender: new ObjectId(session.user.id),
        type: 'project_created',
        title: 'New Project Assigned',
        message: `You have been assigned to project: ${projectData.title}`,
        data: { projectId: result.insertedId },
        isRead: false,
        createdAt: new Date(),
      },
      {
        recipient: new ObjectId(projectData.managerId),
        sender: new ObjectId(session.user.id),
        type: 'project_created',
        title: 'New Project Assignment',
        message: `You have been assigned as manager for: ${projectData.title}`,
        data: { projectId: result.insertedId },
        isRead: false,
        createdAt: new Date(),
      }
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
            localField: 'manager',
            foreignField: '_id',
            as: 'managerData',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        {
          $addFields: {
            client: { $arrayElemAt: ['$clientData', 0] },
            manager: { $arrayElemAt: ['$managerData', 0] }
          }
        },
        { $unset: ['clientData', 'managerData'] }
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