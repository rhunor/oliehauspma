// src/components/dashboard/layout.tsx - PROPER FIX: Original code with modal={false} solution
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSocket } from '@/contexts/SocketContext';
import { NotificationBell } from '@/components/notifications/NotificationSystem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  FolderOpen,
  ClipboardList,
  MessageSquare,
  FileText,
  Calendar,
  Users,
  BarChart,
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Power
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: number;
}

interface MessageStats {
  unreadCount: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const socket = useSocket();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messageStats, setMessageStats] = useState<MessageStats>({ unreadCount: 0 });

  const userRole = session?.user?.role || '';
  const userName = session?.user?.name || '';
  const userEmail = session?.user?.email || '';

  // Get role-specific settings route
  const getSettingsRoute = useCallback(() => {
    switch (userRole) {
      case 'super_admin':
        return '/admin/settings';
      case 'project_manager':
        return '/manager/settings';
      case 'client':
        return '/client/settings';
      default:
        return '/login';
    }
  }, [userRole]);

  // Load message statistics
  const loadMessageStats = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/stats');
      const data = await response.json();
      if (data.success) {
        setMessageStats(data.data);
      }
    } catch (error) {
      console.error('Error loading message stats:', error);
    }
  }, []);

  // Listen for new messages to update badge
  useEffect(() => {
    if (!socket?.socket) return;

    const unsubscribe = socket.onNewMessage(() => {
      setMessageStats(prev => ({ unreadCount: prev.unreadCount + 1 }));
    });

    return unsubscribe;
  }, [socket]);

  useEffect(() => {
    loadMessageStats();
  }, [loadMessageStats]);

  // Navigation items based on user role
  const getNavItems = (): NavItem[] => {
    const baseRoute = userRole === "super_admin" ? "/admin" : 
                     userRole === "project_manager" ? "/manager" : "/client";
    
    const commonRoutes: NavItem[] = [
      {
        name: "Dashboard",
        href: baseRoute,
        icon: Home,
        roles: ["super_admin", "project_manager", "client"],
      },
      {
        name: "Projects",
        href: `${baseRoute}/projects`,
        icon: FolderOpen,
        roles: ["super_admin", "project_manager", "client"],
      },
      {
        name: "Site Schedule",
        href: `${baseRoute}/site-schedule`,
        icon: ClipboardList,
        roles: ["super_admin", "project_manager", "client"],
      },
      {
        name: "Messages",
        href: `${baseRoute}/messages`,
        icon: MessageSquare,
        roles: ["super_admin", "project_manager", "client"],
        badge: messageStats.unreadCount || 0,
      },
      {
        name: "Files",
        href: `${baseRoute}/files`,
        icon: FileText,
        roles: ["super_admin", "project_manager", "client"],
      },
      {
        name: "Calendar",
        href: `${baseRoute}/calendar`,
        icon: Calendar,
        roles: ["super_admin", "project_manager", "client"],
      },
    ];

    // Add role-specific routes
    if (userRole === "super_admin") {
      commonRoutes.push(
        {
          name: "Users",
          href: "/admin/users",
          icon: Users,
          roles: ["super_admin"],
        },
        {
          name: "Analytics",
          href: "/admin/analytics",
          icon: BarChart,
          roles: ["super_admin"],
        }
      );
    }

    return commonRoutes;
  };

  const navItems = getNavItems();

  const handleSignOut = async () => {
    if (socket?.disconnect) {
      socket.disconnect();
    }
    await signOut({ callbackUrl: '/login' });
  };

  const handleSocketToggle = () => {
    if (socket?.isConnected) {
      socket.disconnect();
    } else {
      socket?.connect();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-shrink-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col w-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between h-16 px-6 bg-white border-b">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Project Manager</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                             (item.href !== '/' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-50 border-r-2 border-blue-500 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Socket connection status */}
          <div className="px-4 py-4 border-t">
            <div className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg ${
              socket?.isConnected 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              <div className="flex items-center space-x-2">
                {socket?.isConnected ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {socket?.isConnected ? 'Real-time' : 'Offline'}
                </span>
              </div>
              
              <button
                onClick={handleSocketToggle}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title={socket?.isConnected ? 'Disconnect' : 'Connect'}
              >
                <Power className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navigation - ORIGINAL CODE STRUCTURE */}
        <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex-1">
              {/* Search or other content can go here */}
            </div>

            {/* Right section - Notifications and User menu */}
            <div className="flex items-center space-x-4">
              <NotificationBell />

              {/* CRITICAL FIX: User menu with modal={false} to prevent scroll blocking */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-600 text-white">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                
                {/* SOLUTION: modal={false} goes on DropdownMenu component above */}
                <DropdownMenuContent 
                  className="w-56" 
                  align="end" 
                  forceMount
                >
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{userName}</p>
                      <p className="text-xs text-gray-500">{userEmail}</p>
                      <Badge variant="secondary" className="w-fit text-xs">
                        {userRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={getSettingsRoute()} className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}