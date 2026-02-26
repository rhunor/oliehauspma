// src/app/(dashboard)/client/messages/page.tsx - FIXED WITH MANAGER COMMUNICATION
import { auth } from '@/lib/auth';
import MessagesClient from '@/components/messaging/MessagesClient';

export default async function ClientMessagesPage() {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <MessagesClient 
      userId={session.user.id}
      userRole={session.user.role}
      userName={session.user.name || 'Client'}
    />
  );
}