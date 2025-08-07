// src/lib/api-wrapper.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from './auth';
import { connectToDatabase, withRetry } from './db';
import { Db } from 'mongodb';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiContext {
  db: Db;
  session: Session | null;
}

export type ApiHandler<T = unknown> = (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<T>>,
  context: ApiContext
) => Promise<void>;

export function withApiHandler<T = unknown>(handler: ApiHandler<T>) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    try {
      // Set CORS headers for development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      // Get database connection with retry
      const { db } = await withRetry(async () => {
        return await connectToDatabase();
      }, 3, 1000);

      // Get session
      const session = await getServerSession(req, res, authOptions);

      // Call the actual handler
      await handler(req, res, { db, session });

    } catch (error: unknown) {
      console.error('API Handler Error:', error);

      let errorMessage = 'Internal server error';
      let statusCode = 500;

      if (error instanceof Error) {
        if (error.message.includes('Server selection timed out')) {
          errorMessage = 'Database connection temporarily unavailable. Please try again.';
          statusCode = 503; // Service Unavailable
        } else if (error.message.includes('MongoServerSelectionError')) {
          errorMessage = 'Unable to connect to database. Please try again in a moment.';
          statusCode = 503;
        } else if (error.message.includes('Unauthorized') || error.message.includes('authentication')) {
          errorMessage = 'Authentication required';
          statusCode = 401;
        } else if (error.message.includes('Forbidden') || error.message.includes('permission')) {
          errorMessage = 'Insufficient permissions';
          statusCode = 403;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  };
}

// Example usage in an API route:
// export default withApiHandler(async (req, res, { db, session }) => {
//   // Your API logic here
//   const users = await db.collection('users').find({}).toArray();
//   res.status(200).json({ success: true, data: users });
// });