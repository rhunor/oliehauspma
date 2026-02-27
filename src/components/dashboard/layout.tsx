// src/components/dashboard/layout.tsx - UPDATED: Move existing nav items to bottom navigation on mobile
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSocket } from '@/contexts/SocketContext';
import { NotificationBell } from '@/components/notifications/NotificationSystem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus_Jakarta_Sans } from 'next/font/google';
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
  Power,
  MoreHorizontal
} from 'lucide-react';
import { Search } from 'lucide-react';

// NEXT.JS FONT: must be called at module scope
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

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
  const router = useRouter();
  const socket = useSocket();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messageStats, setMessageStats] = useState<MessageStats>({ unreadCount: 0 });
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const userRole = session?.user?.role || '';
  const userName = session?.user?.name || '';
  const userEmail = session?.user?.email || '';

  const roleLabel = userRole === 'super_admin' ? 'Admin' : userRole === 'project_manager' ? 'Manager' : 'Client';

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

  // EXISTING Navigation items based on user role (PRESERVED)
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

  const handleSignOut = async (): Promise<void> => {
    try {
      if (socket?.disconnect) {
        socket.disconnect();
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = origin ? `${origin}/login` : '/login';
      await signOut({ callbackUrl: target, redirect: true });
      // Fallback navigation in case NextAuth doesn't redirect immediately (local dev)
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          router.replace('/login');
        }
      }, 300);
    } catch {
      // Force navigation as a last resort
      router.replace('/login');
    }
  };

  const handleSocketToggle = () => {
    if (socket?.isConnected) {
      socket.disconnect();
    } else {
      socket?.connect();
    }
  };

  // Get bottom navigation items (first 4 + More for overflow)
  const getBottomNavItems = () => {
    const primaryItems = navItems.slice(0, 4); // First 4 items
    const overflowItems = navItems.slice(4); // Remaining items
    
    return {
      primaryItems,
      overflowItems,
      hasOverflow: overflowItems.length > 0
    };
  };

  const { primaryItems, overflowItems, hasOverflow } = getBottomNavItems();

  // Raise AI button on mobile when More menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (showMoreMenu) {
      root.classList.add('mobile-more-open');
    } else {
      root.classList.remove('mobile-more-open');
    }
  }, [showMoreMenu]);

  return (
    <div className={`${jakarta.className} min-h-screen bg-neutral-100 flex flex-col`}>
      {/* Mobile sidebar overlay - Only visible on larger screens now */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar - Hidden on mobile, shown on desktop */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-64 lg:bg-white lg:shadow-md lg:flex lg:flex-col`}>
        <div className="flex flex-col w-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between h-16 px-6 bg-white border-b">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm tracking-wide">OH</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-gray-900">OliveHaus</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
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
                      ? 'bg-primary-50 border-r-2 border-primary-500 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
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
          {/* Bottom actions: settings/logout + connection badge */}
          <div className="px-4 py-4 border-t space-y-2">
            <Link href={getSettingsRoute()} className="flex items-center px-2 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50">
              <Settings className="mr-3 h-4 w-4 text-gray-500" />
              <span>Settings</span>
            </Link>
            <button onClick={handleSignOut} className="w-full flex items-center px-2 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50">
              <LogOut className="mr-3 h-4 w-4 text-gray-500" />
              <span>Logout</span>
            </button>
            <div className={`mt-2 flex items-center justify-between px-3 py-2 text-xs rounded-lg ${
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
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top navigation - Updated for mobile-first */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 lg:block">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            {/* Mobile: Logo and app name, Desktop: Search */}
              <div className="flex items-center lg:flex-1">
                <div className="lg:hidden flex items-center">
                  <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                    <span className="text-white font-bold text-sm tracking-wide">OH</span>
                  </div>
                  <span className="font-semibold text-gray-900">OliveHaus</span>
                </div>
                {/* Desktop search */}
                <div className="hidden lg:flex items-center w-full max-w-md ml-4">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search task"
                      className="w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Right section - Notifications and User menu */}
              <div className="flex items-center space-x-4">
                <NotificationBell />
                {/* User identity (desktop) */}
                <div className="hidden lg:flex items-center space-x-3 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary-500 text-white">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-slate-900">{userName || 'User'}</p>
                    <p className="text-xs text-slate-500">{userEmail || 'user@example.com'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-6">
          <div className="mx-auto w-full max-w-7xl px-4 lg:px-8 py-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation - EXISTING NAV ITEMS */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="px-2 py-2 pb-safe">
            <div className="flex items-center justify-around">
              {/* Primary Navigation Items (First 4) */}
              {primaryItems.map((item) => {
                const isActive = pathname === item.href || 
                               (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 text-xs touch-manipulation relative"
                  >
                    {/* Badge for notifications */}
                    {item.badge && item.badge > 0 && (
                      <div className="absolute -top-1 -right-1 z-10">
                        <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {item.badge > 99 ? '99+' : item.badge}
                        </Badge>
                      </div>
                    )}
                    
                    <item.icon className={`h-6 w-6 mb-1 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
                    <span className={`truncate text-xs ${isActive ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}

              {/* More Menu (if there are overflow items) */}
              {hasOverflow && (
                <DropdownMenu modal={false} open={showMoreMenu} onOpenChange={setShowMoreMenu}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 text-xs touch-manipulation">
                      <MoreHorizontal className="h-6 w-6 mb-1 text-gray-500" />
                      <span className="truncate text-xs text-gray-500">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" side="top">
                    {overflowItems.map((navItem) => (
                      <DropdownMenuItem key={navItem.name} asChild>
                        <Link href={navItem.href} onClick={() => setShowMoreMenu(false)}>
                          <navItem.icon className="mr-2 h-4 w-4" />
                          <span>{navItem.name}</span>
                          {navItem.badge && navItem.badge > 0 && (
                            <Badge variant="secondary" className="ml-auto">
                              {navItem.badge > 99 ? '99+' : navItem.badge}
                            </Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getSettingsRoute()} onClick={() => setShowMoreMenu(false)}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setShowMoreMenu(false); handleSignOut(); }}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}