// src/app/api/user/profile/route.ts - USER PROFILE API WITH PROPER TYPES
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { updateProfileSchema } from '@/lib/validation';

// Define proper TypeScript interfaces
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
}

// GET /api/user/profile - Get current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const user = await db.collection<UserDocument>('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Convert to client-compatible format
    const profile = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString() || null
    };

    return NextResponse.json({
      success: true,
      profile
    });

  } catch (error: unknown) {
    console.error('Error fetching user profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as UpdateProfileData;
    
    // Validate the input
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Check if email is being changed and if it's already in use
    if (body.email && body.email !== session.user.email) {
      const existingUser = await db.collection<UserDocument>('users').findOne({
        email: body.email.toLowerCase(),
        _id: { $ne: new ObjectId(session.user.id) }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email address is already in use' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name.trim();
    if (body.email) updateData.email = body.email.toLowerCase();
    if (body.phone !== undefined) updateData.phone = body.phone || undefined;
    if (body.bio !== undefined) updateData.bio = body.bio || undefined;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || undefined;

    // Update user profile
    const result = await db.collection<UserDocument>('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get updated user profile
    const updatedUser = await db.collection<UserDocument>('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    // Convert to client-compatible format
    const profile = {
      _id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone || '',
      bio: updatedUser.bio || '',
      avatar: updatedUser.avatar || '',
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt.toISOString(),
      lastLogin: updatedUser.lastLogin?.toISOString() || null
    };

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile
    });

  } catch (error: unknown) {
    console.error('Error updating user profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}