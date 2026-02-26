// src/app/api/users/route.ts - ENHANCED: Allow managers to access users for project creation
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';

// Define user document interface
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  role: 'super_admin' | 'project_manager' | 'client';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  phone?: string;
  avatar?: string;
  lastLoginAt?: Date;
}

// Define response interface
interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  avatar?: string;
  lastLoginAt?: string;
}

// GET /api/users - Retrieve users with role-based access control
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized - Authentication required' 
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const role = searchParams.get('role');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const { db } = await connectToDatabase();
    
    // ENHANCED: Role-based access control for user data
    const userRole = session.user.role;
    
    // Define what roles can access user data
    const canAccessUsers = ['super_admin', 'project_manager'].includes(userRole);
    
    if (!canAccessUsers) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Insufficient permissions to access user data' 
        },
        { status: 403 }
      );
    }

    // Build filter based on permissions and query params
    const filter: Filter<UserDocument> = {};

    // ENHANCED: Limit what project managers can see
    if (userRole === 'project_manager') {
      // Project managers can only see clients and other project managers
      // They cannot see super admins for security reasons
      filter.role = { $in: ['client', 'project_manager'] as const };
    }
    // Super admins can see all users (no additional filter)

    // Apply additional filters from query params
    if (role) {
      const requestedRoles = role.split(',').map(r => r.trim());
      
      // If project manager, filter out super_admin from requested roles
      if (userRole === 'project_manager') {
        const allowedRoles = requestedRoles.filter(r => ['client', 'project_manager'].includes(r));
        if (allowedRoles.length > 0) {
          // Type assertion to satisfy MongoDB filter types
          filter.role = { $in: allowedRoles as ('client' | 'project_manager')[] };
        }
      } else {
        // Super admin can filter by any role - need type assertion
        const validRoles = requestedRoles.filter(r => 
          ['super_admin', 'project_manager', 'client'].includes(r)
        );
        if (validRoles.length > 0) {
          filter.role = { $in: validRoles as ('super_admin' | 'project_manager' | 'client')[] };
        }
      }
    }

    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await db.collection<UserDocument>('users').countDocuments(filter);

    // Get users with pagination
    const users = await db.collection<UserDocument>('users')
      .find(filter, { projection: { password: 0 } }) // Exclude password field
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Transform users for response
    const transformedUsers: UserResponse[] = users.map(user => ({
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      phone: user.phone,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt?.toISOString(),
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        users: transformedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    
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

// POST /api/users - Create new user (Super admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Only super admins can create users
    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Only super administrators can create users' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Name, email, and role are required' 
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      email: body.email.toLowerCase()
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User with this email already exists' 
        },
        { status: 409 }
      );
    }

    // Create user document
    const now = new Date();
    const userDoc = {
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      role: body.role,
      isActive: body.isActive !== undefined ? body.isActive : true,
      phone: body.phone || undefined,
      avatar: body.avatar || undefined,
      password: body.password || undefined, // Should be hashed in real implementation
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('users').insertOne(userDoc);

    // Get the created user (without password)
    const createdUser = await db.collection<UserDocument>('users')
      .findOne(
        { _id: result.insertedId },
        { projection: { password: 0 } }
      );

    if (!createdUser) {
      throw new Error('Failed to retrieve created user');
    }

    // Transform for response
    const responseUser: UserResponse = {
      _id: createdUser._id.toString(),
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      isActive: createdUser.isActive,
      createdAt: createdUser.createdAt.toISOString(),
      updatedAt: createdUser.updatedAt.toISOString(),
      phone: createdUser.phone,
      avatar: createdUser.avatar,
    };

    return NextResponse.json({
      success: true,
      data: responseUser,
      message: 'User created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating user:', error);
    
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