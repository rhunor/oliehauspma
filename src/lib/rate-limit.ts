// src/lib/rate-limit.ts
// Rate limiting utility for API routes
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// For production with multiple servers, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 15 minutes)
  maxRequests?: number; // Max requests per window (default: 100)
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

const defaultConfig: Required<Omit<RateLimitConfig, 'skipSuccessfulRequests' | 'skipFailedRequests'>> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests, please try again later.',
};

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware for API routes
 * @param identifier - Unique identifier (usually IP address or user ID)
 * @param config - Rate limit configuration
 * @returns Object with success status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): { success: boolean; limit: number; remaining: number; reset: number } {
  const { windowMs, maxRequests, message } = { ...defaultConfig, ...config };
  
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or entry expired, create new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetTime,
    };
  }

  // Check if rate limit exceeded
  if (entry.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get identifier from request (IP address or user ID)
 */
export function getIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Get IP address from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Rate limit middleware wrapper for API routes
 * Usage in API route:
 * 
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request);
 *   if (rateLimitResult) return rateLimitResult;
 *   
 *   // Your API logic here
 * }
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = {}
): Promise<NextResponse | null> {
  // Get user ID from headers (set by middleware)
  const userId = request.headers.get('x-user-id') || undefined;
  
  // Get identifier
  const identifier = getIdentifier(request, userId);
  
  // Check rate limit
  const result = checkRateLimit(identifier, config);

  // Add rate limit headers to all responses
  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };

  // If rate limit exceeded, return 429 response
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: config.message || defaultConfig.message,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  // Rate limit passed, return null (no error)
  return null;
}

/**
 * Preset rate limit configurations for common use cases
 */
export const rateLimitPresets = {
  // Strict rate limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  
  // Standard rate limit for general API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests. Please try again later.',
  },
  
  // Loose rate limit for file uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: 'Upload limit reached. Please try again later.',
  },
  
  // Very strict rate limit for password reset
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again in an hour.',
  },
  
  // Moderate rate limit for search/query endpoints
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many search requests. Please slow down.',
  },
};

/**
 * Example usage in API route:
 * 
 * import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
 * 
 * export async function POST(request: NextRequest) {
 *   // Apply strict auth rate limiting
 *   const rateLimitResult = await rateLimit(request, rateLimitPresets.auth);
 *   if (rateLimitResult) return rateLimitResult;
 *   
 *   // Your authentication logic here
 *   // ...
 * }
 */

