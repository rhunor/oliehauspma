// src/app/api/notifications/subscribe/route.ts - Push Notification Subscription
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// POST /api/notifications/subscribe - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid subscription data' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Store or update push subscription
    await db.collection('push_subscriptions').replaceOne(
      { userId: new ObjectId(session.user.id) },
      {
        userId: new ObjectId(session.user.id),
        subscription,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      data: { message: 'Push subscription saved successfully' }
    });

  } catch (error: unknown) {
    console.error('Error saving push subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

// DELETE /api/notifications/subscribe - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    await db.collection('push_subscriptions').deleteOne({
      userId: new ObjectId(session.user.id)
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Push subscription removed successfully' }
    });

  } catch (error: unknown) {
    console.error('Error removing push subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}