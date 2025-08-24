// src/app/unauthorized/page.tsx - SIMPLE FIX: Added Suspense boundary for useSearchParams
'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Shield, 
  Home, 
  RefreshCw, 
  LogOut, 
  AlertTriangle,
  ArrowLeft,
  User,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function UnauthorizedPageContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ENHANCED: Get the intended route from URL params
  const intendedRoute = searchParams.get('callbackUrl') || searchParams.get('from');

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

  // ENHANCED: Smart redirect function
  const handleSmartRedirect = useCallback(() => {
    setIsRetrying(true);
    
    if (session?.user?.role) {
      // If there's an intended route and user has permission, go there
      if (intendedRoute && intendedRoute.startsWith('/')) {
        const userRole = session.user.role;
        const allowedPaths = getAllowedPathsForRole(userRole);
        
        if (allowedPaths.some(path => intendedRoute.startsWith(path))) {
          router.push(intendedRoute);
          return;
        }
      }
      
      // Otherwise, go to role-based dashboard
      const dashboardPath = getRoleBasedDashboard(session.user.role);
      router.push(dashboardPath);
    } else {
      // No session, redirect to login with callback
      const loginUrl = intendedRoute 
        ? `/login?callbackUrl=${encodeURIComponent(intendedRoute)}`
        : '/login';
      router.push(loginUrl);
    }
  }, [session?.user?.role, intendedRoute, getRoleBasedDashboard, router]);

  // ENHANCED: Initialize auto-redirect for authenticated users
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setAutoRedirectEnabled(true);
      setCountdown(5); // 5 second countdown
    } else if (status === 'unauthenticated') {
      // For unauthenticated users, don't auto-redirect
      setAutoRedirectEnabled(false);
      setCountdown(0);
    }
  }, [status, session]);

  // Auto-redirect countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (autoRedirectEnabled && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (autoRedirectEnabled && countdown === 0) {
      handleSmartRedirect();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, autoRedirectEnabled, handleSmartRedirect]);

  // Enhanced session refresh
  const handleRefreshSession = async () => {
    setIsRetrying(true);
    
    try {
      // Update the session to get latest data
      const updatedSession = await update();
      
      if (updatedSession?.user) {
        // Session refreshed successfully, redirect
        handleSmartRedirect();
      } else {
        // Still no valid session, reload page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      // Fallback: reload the page
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    try {
      const callbackUrl = '/login';
      await signOut({ callbackUrl });
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback: navigate to login manually
      router.push('/login');
    }
  };

  // Helper function to get allowed paths for role
  const getAllowedPathsForRole = (role: string): string[] => {
    switch (role) {
      case 'super_admin':
        return ['/admin', '/manager', '/client'];
      case 'project_manager':
        return ['/manager', '/admin/projects', '/admin/site-schedule', '/admin/messages', '/admin/files', '/admin/calendar'];
      case 'client':
        return ['/client', '/admin/projects', '/admin/site-schedule', '/admin/messages', '/admin/files', '/admin/calendar'];
      default:
        return [];
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Checking authentication...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
            {session?.user ? 'Access Restricted' : 'Authentication Required'}
          </CardTitle>
          
          <p className="text-gray-600 text-base">
            {session?.user 
              ? "You don't have permission to access this resource"
              : "Please sign in to access this page"
            }
          </p>
          
          {intendedRoute && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Trying to access: <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">{intendedRoute}</code>
              </p>
            </div>
          )}
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
                
                {autoRedirectEnabled && countdown > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
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
                    ? `Your current role (${getRoleDisplayName(session.user.role)}) doesn't have access to this resource. You'll be redirected to your dashboard.`
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button 
                    onClick={handleSmartRedirect}
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
                  
                  <Button 
                    onClick={handleRefreshSession}
                    variant="outline"
                    disabled={isRetrying}
                    className="w-full"
                    size={isMobile ? "lg" : "default"}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Session
                  </Button>
                </div>
                
                <Button 
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  size={isMobile ? "lg" : "default"}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                {/* Unauthenticated User Actions */}
                <Button 
                  onClick={() => {
                    const loginUrl = intendedRoute 
                      ? `/login?callbackUrl=${encodeURIComponent(intendedRoute)}`
                      : '/login';
                    router.push(loginUrl);
                  }}
                  className="w-full"
                  size={isMobile ? "lg" : "default"}
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                
                <Button 
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="w-full"
                  size={isMobile ? "lg" : "default"}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </>
            )}
          </div>

          {/* Auto-redirect control for authenticated users */}
          {session?.user && autoRedirectEnabled && (
            <div className="text-center pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoRedirectEnabled(false);
                  setCountdown(0);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel auto-redirect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <UnauthorizedPageContent />
    </Suspense>
  );
}