// src/app/api/user/change-password/route.ts - CHANGE PASSWORD API WITH PROPER TYPES
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validation';

// Define proper TypeScript interfaces
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  updatedAt: Date;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// POST /api/user/change-password - Change user password
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as ChangePasswordData;
    
    // Validate the input using the schema but without confirmPassword since it's handled on client
    const validationData = {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.newPassword // We assume client already validated confirmation
    };
    
    const validation = changePasswordSchema.safeParse(validationData);
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

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Get current user with password
    const user = await db.collection<UserDocument>('users').findOne({
      _id: new ObjectId(session.user.id),
      isActive: true
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update user password
    const result = await db.collection<UserDocument>('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Log password change (optional - for security audit)
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(session.user.id),
      action: 'password_changed',
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error: unknown) {
    console.error('Error changing password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}