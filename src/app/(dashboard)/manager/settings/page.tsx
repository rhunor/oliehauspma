// src/app/(dashboard)/manager/settings/page.tsx - MANAGER SETTINGS PAGE
import { auth } from '@/lib/auth';
import SettingsClient from '@/components/settings/SettingsClient'

export default async function ManagerSettingsPage() {
  const session = await auth();
  
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
    <SettingsClient 
      userId={session.user.id}
      userRole={session.user.role}
      userName={session.user.name || 'Manager'}
      userEmail={session.user.email || ''}
    />
  );
}