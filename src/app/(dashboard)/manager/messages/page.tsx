// src/app/(dashboard)/manager/messages/page.tsx - FIXED WITH CLIENT COMMUNICATION
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import MessagesClient from '@/components/messaging/MessagesClient';

export default async function ManagerMessagesPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session.user.role !== 'project_manager') {
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
      userName={session.user.name || 'Manager'}
    />
  );
}