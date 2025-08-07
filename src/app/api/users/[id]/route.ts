// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { updateProfileSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const userId = params.id;

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check permission - users can only access their own data unless super admin
    if (session.user.role !== 'super_admin' && session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const userId = params.id;

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check permission - users can only update their own data unless super admin
    if (session.user.role !== 'super_admin' && session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // For super admin updating other users, allow role and isActive changes
    let validationSchema = updateProfileSchema;
    if (session.user.role === 'super_admin' && session.user.id !== userId) {
      validationSchema = updateProfileSchema.extend({
        role: z.enum(['super_admin', 'project_manager', 'client'] as const).optional(),
        isActive: z.boolean().optional(),
      });
    }

    // Validate request body
    const validation = validationSchema.safeParse(body);
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

    const updateData = validation.data;

    // Check if user exists
    const existingUser = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if email is being changed and if it already exists
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await db.collection('users').findOne({
        email: updateData.email,
        _id: { $ne: new ObjectId(userId) }
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update object
    const update: Record<string, unknown> = {
      ...updateData,
      updatedAt: new Date(),
    };

    // Update user
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return updated user data (without password)
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });

  } catch (error: unknown) {
    console.error('Error updating user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const userId = params.id;

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has active projects as manager
    const managedProjects = await db.collection('projects').countDocuments({
      manager: new ObjectId(userId),
      status: { $in: ['planning', 'in_progress'] }
    });

    if (managedProjects > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with active managed projects' },
        { status: 400 }
      );
    }

    // Check if user has active projects as client
    const clientProjects = await db.collection('projects').countDocuments({
      client: new ObjectId(userId),
      status: { $in: ['planning', 'in_progress'] }
    });

    if (clientProjects > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with active client projects' },
        { status: 400 }
      );
    }

    // Delete related data
    await Promise.all([
      // Delete notifications
      db.collection('notifications').deleteMany({
        $or: [
          { recipient: new ObjectId(userId) },
          { sender: new ObjectId(userId) }
        ]
      }),
      // Delete chat messages
      db.collection('chatmessages').deleteMany({
        $or: [
          { sender: new ObjectId(userId) },
          { recipient: new ObjectId(userId) }
        ]
      }),
      // Update tasks to remove user references
      db.collection('tasks').updateMany(
        { assignee: new ObjectId(userId) },
        { $unset: { assignee: 1 } }
      ),
    ]);

    // Delete user
    const result = await db.collection('users').deleteOne({
      _id: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });

  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}