// src/app/api/health/route.ts
// Health check endpoint for monitoring and load balancers
import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connectivity
    const dbHealthy = await checkDatabaseHealth();
    
    const healthStatus = {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'operational',
      },
      version: process.env.npm_package_version || '1.0.0',
    };

    // Return 503 if database is down
    if (!dbHealthy) {
      return NextResponse.json(healthStatus, { status: 503 });
    }

    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}

