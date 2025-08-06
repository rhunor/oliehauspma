// src/app/api/project/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createProjectSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';

interface ProjectFilter {
  client?: ObjectId;
  manager?: ObjectId;
  status?: string;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';

    const { db } = await connectToDatabase();
    
    // Build filter based on user role
    const filter: ProjectFilter = {};
    
    if (session.user.role === 'client') {
      filter.client = new ObjectId(session.user.id);
    } else if (session.user.role === 'project_manager') {
      filter.manager = new ObjectId(session.user.id);
    }
    // Super admin can see all projects (no additional filter)

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await db.collection('projects').countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Get projects with populated user data
    const projects = await db.collection('projects')
      .aggregate([
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
        { $skip: skip },
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
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = createProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    const projectData = validation.data;
    const { db } = await connectToDatabase();

    // Verify client and manager exist
    const client = await db.collection('users').findOne({ 
      _id: new ObjectId(projectData.clientId),
      role: 'client',
      isActive: true 
    });

    const manager = await db.collection('users').findOne({ 
      _id: new ObjectId(projectData.managerId),
      role: 'project_manager',
      isActive: true 
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or inactive' },
        { status: 400 }
      );
    }

    if (!manager) {
      return NextResponse.json(
        { error: 'Project manager not found or inactive' },
        { status: 400 }
      );
    }

    // Create project document
    const newProject = {
      title: projectData.title,
      description: projectData.description,
      client: new ObjectId(projectData.clientId),
      manager: new ObjectId(projectData.managerId),
      status: 'planning',
      priority: projectData.priority || 'medium',
      startDate: new Date(projectData.startDate),
      endDate: new Date(projectData.endDate),
      budget: projectData.budget,
      progress: 0,
      tasks: [],
      files: [],
      milestones: [],
      tags: projectData.tags || [],
      notes: projectData.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('projects').insertOne(newProject);

    // Return project with populated user data
    const createdProject = await db.collection('projects')
      .aggregate([
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
      { error: errorMessage },
      { status: 500 }
    );
  }
}