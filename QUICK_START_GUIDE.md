# Quick Start Guide - New Features

## 🚀 Quick Reference

### 1. Using the Logger

```typescript
import { logInfo, logError, logAudit } from '@/lib/logger';

// In your API routes
logInfo('Processing request', { userId }, 'API');
logError('Failed to process', error, 'API');
logAudit('User deleted project', userId, { projectId });
```

### 2. Adding Rate Limiting to API Routes

```typescript
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Add this at the start of your handler
  const rateLimitResult = await rateLimit(request, rateLimitPresets.api);
  if (rateLimitResult) return rateLimitResult;
  
  // Your code here...
}
```

### 3. Validating Files Server-Side

```typescript
import { validateFile } from '@/lib/file-validation';

const validationResult = await validateFile(file);
if (!validationResult.isValid) {
  return NextResponse.json({ error: validationResult.error }, { status: 400 });
}
```

### 4. Health Check

```bash
# Check if your app is healthy
curl http://localhost:3000/api/health
```

### 5. Password Reset for Users

**Users can now:**
1. Click "Forgot password?" on login page
2. Enter their email
3. Check email for reset link
4. Set new password
5. Login with new password

**Admin actions:**
- Clean up expired tokens (optional, runs automatically):
```typescript
import { cleanupExpiredResetTokens } from '@/lib/password-reset';
await cleanupExpiredResetTokens();
```

## 📝 Common Tasks

### Add Rate Limiting to a New API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logInfo, logError } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResult = await rateLimit(request, rateLimitPresets.api);
    if (rateLimitResult) return rateLimitResult;

    // 2. Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Your logic here
    logInfo('Processing request', { userId: session.user.id }, 'API');
    
    // ... your code ...

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Request failed', error, 'API');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### Create Custom Rate Limit

```typescript
import { rateLimit } from '@/lib/rate-limit';

// Custom rate limit: 10 requests per minute
const rateLimitResult = await rateLimit(request, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many requests, slow down!'
});
```

## ⚠️ Important Reminders

### Before Deploying to Production

1. **Set Environment Variables**
   ```env
   NEXTAUTH_URL=https://yourdomain.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

2. **Test Email Configuration**
   - Send a test password reset
   - Verify email is received

3. **Check Security Headers**
   - Visit https://securityheaders.com
   - Enter your domain
   - Should get A or A+ rating

4. **MongoDB Index**
   - Password reset tokens collection will auto-create
   - Consider adding indexes if needed

5. **Monitor Health**
   - Set up monitoring on `/api/health`
   - Configure alerts for downtime

## 🐛 Troubleshooting

### Password Reset Email Not Sending

1. Check SMTP credentials in `.env`
2. For Gmail, use App Password (not regular password)
3. Test email configuration:
   ```typescript
   import { testEmailConfiguration } from '@/lib/email';
   await testEmailConfiguration();
   ```

### Rate Limiting Too Strict

Adjust the preset or create custom limits:
```typescript
// More lenient
const rateLimitResult = await rateLimit(request, {
  windowMs: 15 * 60 * 1000,
  maxRequests: 200, // Increased from 100
});
```

### File Upload Validation Too Strict

Adjust in `src/app/api/upload/route.ts`:
```typescript
const validationResult = await validateFile(file, {
  maxSizeBytes: 100 * 1024 * 1024, // Increase to 100MB
  checkMagicNumbers: false, // Disable if causing issues
});
```

### CSP Blocking Third-Party Scripts

Update `next.config.js`:
```javascript
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://trusted-domain.com",
```

## 📞 Quick Links

- **Login Page:** `/login`
- **Forgot Password:** `/forgot-password`
- **Reset Password:** `/reset-password?token=...`
- **Health Check:** `/api/health`
- **API Endpoints:**
  - POST `/api/auth/forgot-password`
  - GET/POST `/api/auth/reset-password`

## ✨ Tips

1. **Logging in Development:**
   - All logs show in console
   - Color-coded by level
   - Stack traces for errors

2. **Logging in Production:**
   - Only errors and warnings log to console
   - Integrate Sentry for better tracking
   - Consider log aggregation service

3. **Rate Limiting:**
   - Headers tell users when they can retry
   - Different limits for different actions
   - Uses IP address or user ID

4. **Error Boundary:**
   - Shows pretty error page
   - "Try Again" resets error state
   - Development mode shows error details

---

**Quick Start Complete!** 🎉

Your app now has enterprise-grade security and UX features.

