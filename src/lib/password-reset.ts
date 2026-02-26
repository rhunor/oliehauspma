// src/lib/password-reset.ts
// Password reset token generation and validation
import { connectToDatabase } from './db';
import { sendEmail } from './email';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

interface ResetToken {
  userId: ObjectId;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token for storage (prevent token theft from database)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a password reset token for a user
 * @param email - User's email address
 * @returns Object with success status and message
 */
export async function createPasswordResetToken(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { db } = await connectToDatabase();

    // Find user by email
    const user = await db.collection('users').findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      // Don't reveal that user doesn't exist (security)
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate token
    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token in database
    const resetToken: ResetToken = {
      userId: user._id,
      token: hashedToken,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };

    // Ensure TTL index exists so MongoDB auto-deletes expired tokens
    // (runs quickly if index already exists — safe to call on every reset request)
    await db.collection('password_reset_tokens').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, background: true }
    );

    await db.collection('password_reset_tokens').insertOne(resetToken);

    // Clean up old tokens for this user
    await db.collection('password_reset_tokens').deleteMany({
      userId: user._id,
      _id: { $ne: resetToken.userId },
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Older than 24 hours
    });

    // Send reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;

    const emailSent = await sendEmail({
      to: user.email,
      subject: 'Password Reset Request - OliveHaus PPMA',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
            .warning { background: #fef3c7; padding: 12px; border-radius: 4px; border-left: 4px solid #f59e0b; margin: 15px 0; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.name},</h2>
              <p>We received a request to reset your password for your OliveHaus PPMA account.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <a href="${resetUrl}" class="button">Reset Password</a>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
              
              <div class="warning">
                <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                  <li>This link expires in <strong>1 hour</strong></li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Your password will not change unless you click the link above</li>
                </ul>
              </div>
              
              <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} OliveHaus PPMA. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

Hello ${user.name},

We received a request to reset your password for your OliveHaus PPMA account.

Click the link below to reset your password:
${resetUrl}

⚠️ Important:
- This link expires in 1 hour
- If you didn't request this, please ignore this email
- Your password will not change unless you click the link above

If you did not request a password reset, please ignore this email or contact support.

© ${new Date().getFullYear()} OliveHaus PPMA. All rights reserved.
      `,
    });

    if (!emailSent) {
      return {
        success: false,
        message: 'Failed to send reset email. Please try again.',
      };
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  } catch (error) {
    console.error('Error creating password reset token:', error);
    return {
      success: false,
      message: 'An error occurred. Please try again later.',
    };
  }
}

/**
 * Validate a password reset token
 * @param token - The reset token from the email link
 * @returns Object with validity status and user ID if valid
 */
export async function validatePasswordResetToken(
  token: string
): Promise<{ isValid: boolean; userId?: string; message?: string }> {
  try {
    const { db } = await connectToDatabase();

    const hashedToken = hashToken(token);

    // Find token in database
    const resetToken = await db.collection('password_reset_tokens').findOne({
      token: hashedToken,
    });

    if (!resetToken) {
      return {
        isValid: false,
        message: 'Invalid or expired reset token.',
      };
    }

    // Check if token is expired
    if (new Date() > new Date(resetToken.expiresAt)) {
      return {
        isValid: false,
        message: 'This reset link has expired. Please request a new one.',
      };
    }

    // Check if token was already used
    if (resetToken.used) {
      return {
        isValid: false,
        message: 'This reset link has already been used.',
      };
    }

    return {
      isValid: true,
      userId: resetToken.userId.toString(),
    };
  } catch (error) {
    console.error('Error validating password reset token:', error);
    return {
      isValid: false,
      message: 'An error occurred. Please try again.',
    };
  }
}

/**
 * Reset user password with a valid token
 * @param token - The reset token from the email link
 * @param newPassword - The new password
 * @returns Object with success status and message
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { db } = await connectToDatabase();

    // Validate token
    const validation = await validatePasswordResetToken(token);
    if (!validation.isValid || !validation.userId) {
      return {
        success: false,
        message: validation.message || 'Invalid token.',
      };
    }

    // Import password hashing function
    const { hashPassword } = await import('./auth');

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await db.collection('users').updateOne(
      { _id: new ObjectId(validation.userId) },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      }
    );

    // Mark token as used
    const hashedToken = hashToken(token);
    await db.collection('password_reset_tokens').updateOne(
      { token: hashedToken },
      {
        $set: {
          used: true,
          usedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      message: 'An error occurred while resetting your password. Please try again.',
    };
  }
}

/**
 * Clean up expired reset tokens (run periodically)
 */
export async function cleanupExpiredResetTokens(): Promise<void> {
  try {
    const { db } = await connectToDatabase();

    const result = await db.collection('password_reset_tokens').deleteMany({
      expiresAt: { $lt: new Date() },
    });

    console.log(`Cleaned up ${result.deletedCount} expired reset tokens`);
  } catch (error) {
    console.error('Error cleaning up expired reset tokens:', error);
  }
}

