// FILE: src/app/api/migrate/managers/route.ts
// Migration API route - Access via: http://localhost:3000/api/migrate/managers

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface OldProjectDocument {
  _id: ObjectId;
  title: string;
  manager?: ObjectId;
  managers?: ObjectId[];
}

export async function POST(request: NextRequest) {
  try {
    // Security: Only super_admin can run migrations
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only super admins can run migrations' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Find all projects that have 'manager' field but no 'managers' array
    const projectsToMigrate = await db.collection<OldProjectDocument>('projects')
      .find({
        manager: { $exists: true },
        $or: [
          { managers: { $exists: false } },
          { managers: { $size: 0 } }
        ]
      })
      .toArray();

    if (projectsToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No projects need migration. All projects already have managers array.',
        stats: {
          total: 0,
          migrated: 0,
          failed: 0
        }
      });
    }

    const results = {
      total: projectsToMigrate.length,
      migrated: 0,
      failed: 0,
      details: [] as Array<{ title: string; status: string; error?: string }>
    };

    for (const project of projectsToMigrate) {
      try {
        if (!project.manager) {
          results.details.push({
            title: project.title,
            status: 'skipped',
            error: 'No manager field found'
          });
          continue;
        }

        // Update project: copy manager to managers array
        await db.collection('projects').updateOne(
          { _id: project._id },
          { 
            $set: { 
              managers: [project.manager],
              updatedAt: new Date()
            }
          }
        );

        results.migrated++;
        results.details.push({
          title: project.title,
          status: 'success'
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          title: project.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed! ${results.migrated} of ${results.total} projects migrated successfully.`,
      stats: results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check migration status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Count projects needing migration
    const needsMigration = await db.collection('projects')
      .countDocuments({
        manager: { $exists: true },
        $or: [
          { managers: { $exists: false } },
          { managers: { $size: 0 } }
        ]
      });

    // Count projects already migrated
    const alreadyMigrated = await db.collection('projects')
      .countDocuments({
        managers: { $exists: true, $not: { $size: 0 } }
      });

    return NextResponse.json({
      success: true,
      status: {
        needsMigration,
        alreadyMigrated,
        total: needsMigration + alreadyMigrated
      },
      ready: needsMigration > 0
    });

  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}