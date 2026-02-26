// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken, validatePasswordResetToken } from '@/lib/password-reset';
import { validatePasswordStrength } from '@/lib/auth';
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logInfo, logError, logAudit } from '@/lib/logger';

// Validate reset token (GET request)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }

    const validation = await validatePasswordResetToken(token);

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          valid: false, 
          message: validation.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Token is valid',
    });

  } catch (error) {
    logError('Token validation error', error, 'AUTH');
    return NextResponse.json(
      { error: 'An error occurred while validating the token' },
      { status: 500 }
    );
  }
}

// Reset password with token (POST request)
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, rateLimitPresets.passwordReset);
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { token, password } = body;

    // Validate inputs
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    logInfo('Password reset attempt', { tokenLength: token.length }, 'AUTH');

    // Reset password
    const result = await resetPasswordWithToken(token, password);

    if (!result.success) {
      logError('Password reset failed', { message: result.message }, 'AUTH');
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Audit log successful password reset
    logAudit('Password reset successfully', 'system', { 
      timestamp: new Date().toISOString() 
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });

  } catch (error) {
    logError('Reset password error', error, 'AUTH');
    return NextResponse.json(
      { error: 'An error occurred while resetting your password' },
      { status: 500 }
    );
  }
}

