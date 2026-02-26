// src/app/api/user/preferences/route.ts - FIXED USER PREFERENCES API WITH PROPER TYPES
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Define proper TypeScript interfaces
interface UserPreferencesDocument {
  _id: ObjectId;
  userId: ObjectId;
  emailNotifications: boolean;
  pushNotifications: boolean;
  projectUpdates: boolean;
  taskReminders: boolean;
  messageAlerts: boolean;
  weeklyReports: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  language: string;
  dateFormat: string;
  createdAt: Date;
  updatedAt: Date;
}

// Use this for insertOne - MongoDB will auto-generate _id
interface UserPreferencesInsertDocument {
  userId: ObjectId;
  emailNotifications: boolean;
  pushNotifications: boolean;
  projectUpdates: boolean;
  taskReminders: boolean;
  messageAlerts: boolean;
  weeklyReports: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  language: string;
  dateFormat: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdatePreferencesData {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  projectUpdates?: boolean;
  taskReminders?: boolean;
  messageAlerts?: boolean;
  weeklyReports?: boolean;
  theme?: 'light' | 'dark' | 'system';
  timezone?: string;
  language?: string;
  dateFormat?: string;
}

interface ClientPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  projectUpdates: boolean;
  taskReminders: boolean;
  messageAlerts: boolean;
  weeklyReports: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  language: string;
  dateFormat: string;
}

const defaultPreferences: Omit<UserPreferencesInsertDocument, 'userId' | 'createdAt' | 'updatedAt'> = {
  emailNotifications: true,
  pushNotifications: true,
  projectUpdates: true,
  taskReminders: true,
  messageAlerts: true,
  weeklyReports: false,
  theme: 'light',
  timezone: 'Africa/Lagos',
  language: 'en',
  dateFormat: 'DD/MM/YYYY'
};

// GET /api/user/preferences - Get user preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Try to get existing preferences
    let preferences = await db.collection<UserPreferencesDocument>('user_preferences').findOne({
      userId
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      const newPreferences: UserPreferencesInsertDocument = {
        userId,
        ...defaultPreferences,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<UserPreferencesInsertDocument>('user_preferences').insertOne(newPreferences);
      
      preferences = await db.collection<UserPreferencesDocument>('user_preferences').findOne({
        _id: result.insertedId
      });
    }

    if (!preferences) {
      throw new Error('Failed to create or retrieve preferences');
    }

    // Convert to client-compatible format
    const clientPreferences: ClientPreferences = {
      emailNotifications: preferences.emailNotifications,
      pushNotifications: preferences.pushNotifications,
      projectUpdates: preferences.projectUpdates,
      taskReminders: preferences.taskReminders,
      messageAlerts: preferences.messageAlerts,
      weeklyReports: preferences.weeklyReports,
      theme: preferences.theme,
      timezone: preferences.timezone,
      language: preferences.language,
      dateFormat: preferences.dateFormat
    };

    return NextResponse.json({
      success: true,
      preferences: clientPreferences
    });

  } catch (error: unknown) {
    console.error('Error fetching user preferences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as UpdatePreferencesData;
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Validate boolean fields
    const booleanFields = [
      'emailNotifications', 
      'pushNotifications', 
      'projectUpdates', 
      'taskReminders', 
      'messageAlerts', 
      'weeklyReports'
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    // Only update provided fields
    for (const [key, value] of Object.entries(body)) {
      if (booleanFields.includes(key)) {
        if (typeof value === 'boolean') {
          updateData[key] = value;
        }
      } else if (key === 'theme') {
        if (['light', 'dark', 'system'].includes(value as string)) {
          updateData[key] = value;
        }
      } else if (key === 'timezone' || key === 'language' || key === 'dateFormat') {
        if (typeof value === 'string' && value.trim()) {
          updateData[key] = value.trim();
        }
      }
    }

    // Try to update existing preferences
    const result = await db.collection<UserPreferencesDocument>('user_preferences').updateOne(
      { userId },
      { $set: updateData },
      { upsert: true }
    );

    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      // If upsert didn't work, create new preferences
      const newPreferences: UserPreferencesInsertDocument = {
        userId,
        ...defaultPreferences,
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as UserPreferencesInsertDocument;

      await db.collection<UserPreferencesInsertDocument>('user_preferences').insertOne(newPreferences);
    }

    // Get updated preferences
    const updatedPreferences = await db.collection<UserPreferencesDocument>('user_preferences').findOne({
      userId
    });

    if (!updatedPreferences) {
      throw new Error('Failed to retrieve updated preferences');
    }

    // Convert to client-compatible format
    const clientPreferences: ClientPreferences = {
      emailNotifications: updatedPreferences.emailNotifications,
      pushNotifications: updatedPreferences.pushNotifications,
      projectUpdates: updatedPreferences.projectUpdates,
      taskReminders: updatedPreferences.taskReminders,
      messageAlerts: updatedPreferences.messageAlerts,
      weeklyReports: updatedPreferences.weeklyReports,
      theme: updatedPreferences.theme,
      timezone: updatedPreferences.timezone,
      language: updatedPreferences.language,
      dateFormat: updatedPreferences.dateFormat
    };

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: clientPreferences
    });

  } catch (error: unknown) {
    console.error('Error updating user preferences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}