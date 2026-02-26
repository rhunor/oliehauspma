// src/app/(dashboard)/admin/settings/page.tsx - ADMIN SETTINGS PAGE
import { auth, authOptions } from '@/lib/auth';
import SettingsClient from '@/components/settings/SettingsClient';

export default async function AdminSettingsPage() {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== 'super_admin') {
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
      userName={session.user.name || 'Admin'}
      userEmail={session.user.email || ''}
    />
  );
}