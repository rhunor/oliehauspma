// src/app/(dashboard)/client/settings/page.tsx - CLIENT SETTINGS PAGE
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SettingsClient from '@/components/settings/SettingsClient';

export default async function ClientSettingsPage() {
  const session = await getServerSession(authOptions);
  
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
    <SettingsClient 
      userId={session.user.id}
      userRole={session.user.role}
      userName={session.user.name || 'Client'}
      userEmail={session.user.email || ''}
    />
  );
}