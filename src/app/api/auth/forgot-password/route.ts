// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/password-reset';
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Apply strict rate limiting for password reset
    const rateLimitResult = await rateLimit(request, rateLimitPresets.passwordReset);
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    logInfo('Password reset requested', { email }, 'AUTH');

    // Create reset token and send email
    const result = await createPasswordResetToken(email);

    if (!result.success) {
      logError('Failed to create password reset token', { email }, 'AUTH');
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    // Always return success message (don't reveal if user exists)
    return NextResponse.json({
      success: true,
      message: result.message,
    });

  } catch (error) {
    logError('Forgot password error', error, 'AUTH');
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}

