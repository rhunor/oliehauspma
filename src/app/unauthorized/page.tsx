// src/app/unauthorized/page.tsx - ENHANCED RESPONSIVE UNAUTHORIZED PAGE
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { 
  Shield, 
  Home, 
  RefreshCw, 
  LogOut, 
  AlertTriangle,
  ArrowLeft,
  User,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function UnauthorizedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isMobile, setIsMobile] = useState(false);

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Enhanced role-based redirect logic
  const getRoleBasedDashboard = useCallback((role: string) => {
    switch (role) {
      case 'super_admin':
        return '/admin';
      case 'project_manager':
        return '/manager';
      case 'client':
        return '/client';
      default:
        return '/login';
    }
  }, []);

  const handleReturnToDashboard = useCallback(() => {
    setIsRetrying(true);
    
    if (session?.user?.role) {
      const dashboardPath = getRoleBasedDashboard(session.user.role);
      router.push(dashboardPath);
    } else {
      router.push('/login');
    }
  }, [session?.user?.role, getRoleBasedDashboard, router]);

  // Auto-redirect countdown for authenticated users
  useEffect(() => {
    if (session?.user && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (session?.user && countdown === 0) {
      handleReturnToDashboard();
    }
  }, [countdown, session, handleReturnToDashboard]);

  const handleRefreshSession = async () => {
    setIsRetrying(true);
    
    try {
      // Force session refresh
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing session:', error);
      setIsRetrying(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getRoleDisplayName = (role?: string) => {
    if (!role) return 'Unknown';
    
    switch (role) {
      case 'super_admin':
        return 'Super Administrator';
      case 'project_manager':
        return 'Project Manager';
      case 'client':
        return 'Client';
      default:
        return role;
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'project_manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'client':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <Shield className="h-8 w-8 text-red-500" />
              </div>
            </div>
            
            <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </CardTitle>
            
            <p className="text-gray-600 text-base">
              {session?.user 
                ? "You don't have permission to access this page"
                : "Authentication required to access this resource"
              }
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* User Info Section (if authenticated) */}
            {session?.user && (
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {session.user.name || 'Unknown User'}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${getRoleColor(session.user.role)}`}>
                    {getRoleDisplayName(session.user.role)}
                  </Badge>
                  
                  {countdown > 0 && (
                    <div className="text-xs text-gray-500">
                      Redirecting in {countdown}s
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Details */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 mb-1">
                    {session?.user ? 'Insufficient Permissions' : 'Authentication Required'}
                  </h4>
                  <p className="text-sm text-yellow-700">
                    {session?.user 
                      ? `Your current role (${getRoleDisplayName(session.user.role)}) doesn't have access to this resource. Contact your administrator if you believe this is an error.`
                      : 'Please sign in with an account that has the required permissions to access this page.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {session?.user ? (
                <>
                  {/* Authenticated User Actions */}
                  <Button 
                    onClick={handleReturnToDashboard}
                    disabled={isRetrying}
                    className="w-full"
                    size={isMobile ? "lg" : "default"}
                  >
                    {isRetrying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <Home className="h-4 w-4 mr-2" />
                        Go to Dashboard
                      </>
                    )}
                  </Button>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handleRefreshSession}
                      disabled={isRetrying}
                      className="flex-1"
                      size={isMobile ? "lg" : "default"}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={handleSignOut}
                      disabled={isRetrying}
                      className="flex-1"
                      size={isMobile ? "lg" : "default"}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Unauthenticated User Actions */}
                  <Button 
                    onClick={() => router.push('/login')}
                    className="w-full"
                    size={isMobile ? "lg" : "default"}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>

                  <Button 
                    variant="outline"
                    onClick={() => router.back()}
                    className="w-full"
                    size={isMobile ? "lg" : "default"}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                </>
              )}
            </div>

            {/* Additional Help Section */}
            <div className="border-t pt-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Need help with access permissions?
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 text-sm">
                  {session?.user?.role !== 'super_admin' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        // In a real app, this could open a support ticket or contact form
                        const subject = encodeURIComponent('Access Permission Request');
                        const body = encodeURIComponent(
                          `Hello,\n\nI need access to a page that I'm currently unauthorized to view.\n\n` +
                          `User: ${session?.user?.name || 'Unknown'}\n` +
                          `Email: ${session?.user?.email || 'Unknown'}\n` +
                          `Current Role: ${getRoleDisplayName(session?.user?.role)}\n` +
                          `Requested Page: ${window.location.href}\n\n` +
                          `Please review my access permissions.\n\nThank you!`
                        );
                        window.location.href = `mailto:admin@olivehaus.com?subject=${subject}&body=${body}`;
                      }}
                      className="flex-1"
                    >
                      Contact Administrator
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // In a real app, this could open documentation
                      window.open('/help/permissions', '_blank');
                    }}
                    className="flex-1"
                  >
                    View Help
                  </Button>
                </div>
              </div>
            </div>

            {/* System Info (for debugging - only show in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="border-t pt-4">
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700 mb-2">
                    Debug Information
                  </summary>
                  <div className="bg-gray-100 p-3 rounded font-mono space-y-1">
                    <div>Session Status: {status}</div>
                    <div>User Role: {session?.user?.role || 'N/A'}</div>
                    <div>User ID: {session?.user?.id || 'N/A'}</div>
                    <div>Current Path: {window.location.pathname}</div>
                    <div>Referrer: {document.referrer || 'Direct'}</div>
                    <div>User Agent: {navigator.userAgent}</div>
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">OH</span>
            </div>
            <span>OliveHaus PPMA System</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            © 2024 OliveHaus. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}