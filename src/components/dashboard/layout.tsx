// src/components/dashboard/layout.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSocket } from '@/contexts/SocketContext';
import { NotificationBell } from '@/components/notifications/NotificationSystem';
import { Badge } from '@/components/ui/badge';
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
  Wifi,
  WifiOff,
  Power,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Search } from 'lucide-react';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
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

  const getSettingsRoute = useCallback(() => {
    switch (userRole) {
      case 'super_admin': return '/admin/settings';
      case 'project_manager': return '/manager/settings';
      case 'client': return '/client/settings';
      default: return '/login';
    }
  }, [userRole]);

  const getNewProjectRoute = useCallback(() => {
    switch (userRole) {
      case 'super_admin': return '/admin/projects';
      case 'project_manager': return '/manager/projects/new';
      default: return '#';
    }
  }, [userRole]);

  const loadMessageStats = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/stats');
      const data = await response.json();
      if (data.success) setMessageStats(data.data);
    } catch (error) {
      console.error('Error loading message stats:', error);
    }
  }, []);

  useEffect(() => {
    if (!socket?.socket) return;
    const unsubscribe = socket.onNewMessage(() => {
      setMessageStats(prev => ({ unreadCount: prev.unreadCount + 1 }));
    });
    return unsubscribe;
  }, [socket]);

  useEffect(() => { loadMessageStats(); }, [loadMessageStats]);

  const getNavItems = (): NavItem[] => {
    const baseRoute = userRole === 'super_admin' ? '/admin'
      : userRole === 'project_manager' ? '/manager' : '/client';

    const commonRoutes: NavItem[] = [
      { name: 'Dashboard', href: baseRoute, icon: Home, roles: ['super_admin', 'project_manager', 'client'] },
      { name: 'Projects', href: `${baseRoute}/projects`, icon: FolderOpen, roles: ['super_admin', 'project_manager', 'client'] },
      { name: 'Site Schedule', href: `${baseRoute}/site-schedule`, icon: ClipboardList, roles: ['super_admin', 'project_manager', 'client'] },
      { name: 'Messages', href: `${baseRoute}/messages`, icon: MessageSquare, roles: ['super_admin', 'project_manager', 'client'], badge: messageStats.unreadCount || 0 },
      { name: 'Files', href: `${baseRoute}/files`, icon: FileText, roles: ['super_admin', 'project_manager', 'client'] },
      { name: 'Calendar', href: `${baseRoute}/calendar`, icon: Calendar, roles: ['super_admin', 'project_manager', 'client'] },
    ];

    if (userRole === 'super_admin') {
      commonRoutes.push(
        { name: 'Users', href: '/admin/users', icon: Users, roles: ['super_admin'] },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart, roles: ['super_admin'] }
      );
    }

    return commonRoutes;
  };

  const navItems = getNavItems();

  const handleSignOut = async (): Promise<void> => {
    try {
      if (socket?.disconnect) socket.disconnect();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = origin ? `${origin}/login` : '/login';
      await signOut({ callbackUrl: target, redirect: true });
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          router.replace('/login');
        }
      }, 300);
    } catch {
      router.replace('/login');
    }
  };

  const handleSocketToggle = () => {
    if (socket?.isConnected) socket.disconnect();
    else socket?.connect();
  };

  const getBottomNavItems = () => {
    const primaryItems = navItems.slice(0, 4);
    const overflowItems = navItems.slice(4);
    return { primaryItems, overflowItems, hasOverflow: overflowItems.length > 0 };
  };

  const { primaryItems, overflowItems, hasOverflow } = getBottomNavItems();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (showMoreMenu) root.classList.add('mobile-more-open');
    else root.classList.remove('mobile-more-open');
  }, [showMoreMenu]);

  const workspaceItems = navItems.filter(item => !['Users', 'Analytics'].includes(item.name));
  const adminItems = navItems.filter(item => ['Users', 'Analytics'].includes(item.name));

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href.includes('/', 1) && pathname.startsWith(item.href + '/'));
    return (
      <Link
        key={item.name}
        href={item.href}
        className="group flex items-center px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-150"
        style={isActive ? {
          background: '#111111',
          color: '#ffffff',
        } : {
          color: '#9CA3AF',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          const active = pathname === item.href || (item.href.includes('/', 1) && pathname.startsWith(item.href + '/'));
          if (!active) {
            el.style.background = '#F5F5F5';
            el.style.color = '#374151';
          }
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          const active = pathname === item.href || (item.href.includes('/', 1) && pathname.startsWith(item.href + '/'));
          if (!active) {
            el.style.background = '';
            el.style.color = '#9CA3AF';
          }
        }}
      >
        <item.icon
          className="mr-3 h-[15px] w-[15px] flex-shrink-0"
          style={isActive ? { color: '#ffffff' } : { color: '#9CA3AF' }}
        />
        <span className="truncate">{item.name}</span>
        {item.badge && item.badge > 0 && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={isActive
              ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
              : { background: '#F3F4F6', color: '#6B7280' }
            }>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className={`${jakarta.className} min-h-screen flex flex-col`} style={{ background: '#F7F7F7' }}>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Desktop Sidebar — WHITE, Equa-style ── */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-60 lg:flex lg:flex-col"
        style={{ background: '#FFFFFF', borderRight: '1px solid #F0F0F0' }}>
        <div className="flex flex-col w-full h-full">

          {/* Logo */}
          <div className="flex items-center h-[60px] px-5" style={{ borderBottom: '1px solid #F5F5F5' }}>
            {/* Small brand icon */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6B7C3B 0%, #4a5629 100%)' }}>
                <span className="text-white font-black text-[10px] tracking-tight">OH</span>
              </div>
              <div className="leading-none">
                <p className="text-[13px] font-bold tracking-wide text-gray-900">OliveHaus</p>
                <p className="text-[9px] tracking-[0.2em] uppercase text-gray-400 mt-px">Interiors</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <div className="space-y-px">
              {/* MAIN section */}
              <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                Main
              </p>
              {workspaceItems.map(renderNavItem)}

              {/* TOOLS / ADMIN section */}
              {adminItems.length > 0 && (
                <div className="pt-4">
                  <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Admin
                  </p>
                  {adminItems.map(renderNavItem)}
                </div>
              )}
            </div>
          </nav>

          {/* Bottom */}
          <div className="px-3 py-4 space-y-px" style={{ borderTop: '1px solid #F5F5F5' }}>
            <Link href={getSettingsRoute()}
              className="flex items-center px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-150"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; }}>
              <Settings className="mr-3 h-[15px] w-[15px] text-gray-400" />
              <span>Settings</span>
            </Link>
            <button onClick={handleSignOut}
              className="w-full flex items-center px-3 py-2 text-[13px] font-medium rounded-xl text-left transition-all duration-150"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; }}>
              <LogOut className="mr-3 h-[15px] w-[15px] text-gray-400" />
              <span>Logout</span>
            </button>

            {/* Socket status */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-[11px] mt-1"
              style={{ background: socket?.isConnected ? '#F0FDF4' : '#F9FAFB', color: socket?.isConnected ? '#16A34A' : '#9CA3AF' }}>
              <div className="flex items-center gap-1.5">
                {socket?.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span className="font-medium">{socket?.isConnected ? 'Live' : 'Offline'}</span>
              </div>
              <button onClick={handleSocketToggle} className="p-0.5 rounded hover:bg-black/5 transition-colors">
                <Power className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

        {/* ── Header — WHITE, Equa-style ── */}
        <header className="sticky top-0 z-40"
          style={{ background: '#FFFFFF', borderBottom: '1px solid #F0F0F0' }}>
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex h-[60px] items-center justify-between px-4 lg:px-6 gap-4">

              {/* Left: mobile logo / desktop search */}
              <div className="flex items-center flex-1 min-w-0">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #6B7C3B 0%, #4a5629 100%)' }}>
                    <span className="text-white font-black text-[10px]">OH</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-900">OliveHaus</p>
                </div>

                {/* Desktop search — Equa style pill */}
                <div className="hidden lg:flex items-center w-full max-w-md">
                  <div className="relative w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search or type a command"
                      className="w-full rounded-full pl-9 pr-16 py-2.5 text-[13px] outline-none transition-all"
                      style={{
                        background: '#F5F5F5',
                        border: '1.5px solid transparent',
                        color: '#111',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.border = '1.5px solid #E5E7EB';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,124,59,0.08)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.background = '#F5F5F5';
                        e.currentTarget.style.border = '1.5px solid transparent';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">
                      ⌘F
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: new project + notifications + avatar */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* New project button — dark pill (Equa style) */}
                {userRole !== 'client' && (
                  <Link href={getNewProjectRoute()}
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#111111' }}>
                    <Plus className="h-3.5 w-3.5" />
                    New Project
                  </Link>
                )}

                <NotificationBell />

                {/* Avatar pill */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-colors hover:bg-gray-100"
                      style={{ border: '1.5px solid #F0F0F0' }}>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-white text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #6B7C3B 0%, #4a5629 100%)' }}>
                          {userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden lg:block leading-tight text-left">
                        <p className="text-[12px] font-semibold text-gray-800">{userName || 'User'}</p>
                        <p className="text-[11px] text-gray-400">{roleLabel}</p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-3 py-2">
                      <p className="text-[13px] font-semibold text-gray-800">{userName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getSettingsRoute()}>
                        <Settings className="mr-2 h-4 w-4" />Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-6">
          <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 py-6">
            {children}
          </div>
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
          style={{ background: '#FFFFFF', borderTop: '1px solid #F0F0F0' }}>
          <div className="px-2 py-2 pb-safe">
            <div className="flex items-center justify-around">
              {primaryItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href.includes('/', 1) && pathname.startsWith(item.href + '/'));
                return (
                  <Link key={item.name} href={item.href}
                    className="flex flex-col items-center justify-center min-w-0 flex-1 py-1.5 px-1 relative">
                    {item.badge && item.badge > 0 && (
                      <div className="absolute top-0 right-1 z-10">
                        <Badge variant="destructive" className="h-4 w-4 rounded-full p-0 flex items-center justify-center text-[9px]">
                          {item.badge > 9 ? '9+' : item.badge}
                        </Badge>
                      </div>
                    )}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-0.5 transition-colors ${isActive ? 'bg-gray-900' : ''}`}>
                      <item.icon className="h-4 w-4"
                        style={{ color: isActive ? '#fff' : '#9CA3AF' }} />
                    </div>
                    <span className="truncate text-[10px]"
                      style={{ color: isActive ? '#111111' : '#9CA3AF', fontWeight: isActive ? 600 : 400 }}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}

              {hasOverflow && (
                <DropdownMenu modal={false} open={showMoreMenu} onOpenChange={setShowMoreMenu}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex flex-col items-center justify-center min-w-0 flex-1 py-1.5 px-1">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-0.5">
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                      </div>
                      <span className="text-[10px] text-gray-400">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" side="top">
                    {overflowItems.map((navItem) => (
                      <DropdownMenuItem key={navItem.name} asChild>
                        <Link href={navItem.href} onClick={() => setShowMoreMenu(false)}>
                          <navItem.icon className="mr-2 h-4 w-4" />
                          <span>{navItem.name}</span>
                          {navItem.badge && navItem.badge > 0 && (
                            <Badge variant="secondary" className="ml-auto">{navItem.badge > 99 ? '99+' : navItem.badge}</Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getSettingsRoute()} onClick={() => setShowMoreMenu(false)}>
                        <Settings className="mr-2 h-4 w-4" /><span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setShowMoreMenu(false); handleSignOut(); }}>
                      <LogOut className="mr-2 h-4 w-4" /><span>Log out</span>
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
