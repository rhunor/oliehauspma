// src/components/dashboard/layout.tsx - FIXED VERSION WITH PROPER DEFENSIVE PROGRAMMING
"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Menu, 
  X,  
  Settings, 
  LogOut, 
  User,
  Search,
  ChevronDown,
  Home,
  Users,
  FolderOpen,
  ClipboardList,
  MessageSquare,
  BarChart,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/layout/NotificationBell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

// ✅ FIXED: Define proper MessageStats interface with default values
interface MessageStats {
  unreadCount: number;
}

// ✅ FIXED: Default message stats to prevent undefined errors
const DEFAULT_MESSAGE_STATS: MessageStats = {
  unreadCount: 0
};

// Enhanced navigation with proper role-based routing
const getNavigationForRole = (userRole: string): NavItem[] => {
  const baseRoute = userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client";
  
  const commonRoutes: NavItem[] = [
    {
      name: "Dashboard",
      href: baseRoute,
      icon: Home,
      roles: ["super_admin", "project_manager", "client"],
    },
    {
      name: "Projects",
      href: `/admin/projects`,
      icon: FolderOpen,
      roles: ["super_admin", "project_manager", "client"],
    },
    {
      name: "Site Schedule",
      href: `/admin/site-schedule`,
      icon: ClipboardList,
      roles: ["super_admin", "project_manager", "client"],
    },
    {
      name: "Messages",
      href: `${baseRoute}/messages`,
      icon: MessageSquare,
      roles: ["super_admin", "project_manager", "client"],
    },
    {
      name: "Files",
      href: `/admin/files`,
      icon: FileText,
      roles: ["super_admin", "project_manager", "client"],
    },
    {
      name: "Calendar",
      href: `/admin/calendar`,
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

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Enhanced responsive state management
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // ✅ FIXED: Initialize with default values to prevent undefined errors
  const [messageStats, setMessageStats] = useState<MessageStats>(DEFAULT_MESSAGE_STATS);
  const [loading, setLoading] = useState(true);
  
  // Enhanced mobile detection and viewport management
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [_viewportWidth, setViewportWidth] = useState(0);

  // Enhanced viewport detection
  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      
      setViewportWidth(width);
      setIsMobile(mobile);
      setIsTablet(tablet);
      
      // Auto-collapse sidebar on tablet when sidebar is open
      if (tablet && sidebarOpen) {
        setSidebarCollapsed(true);
      }
      
      // Ensure sidebar is visible on desktop
      if (width >= 1024) {
        setSidebarCollapsed(false);
      }
      
      // Close mobile sidebar on resize to desktop
      if (width >= 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sidebarOpen]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showProfileMenu && !target.closest('[data-profile-menu]')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // ✅ FIXED: Enhanced message stats fetching with proper error handling and defensive programming
  useEffect(() => {
    const fetchMessageStats = async () => {
      // ✅ Guard clause to prevent API calls when user is not available
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/messages/stats');
        
        if (response.ok) {
          const data = await response.json();
          
          // ✅ FIXED: Defensive programming - validate response structure
          if (data && typeof data === 'object') {
            // ✅ Use optional chaining and nullish coalescing for safe access
            const validatedStats: MessageStats = {
              unreadCount: data.unreadCount ?? data.data?.unreadCount ?? 0
            };
            setMessageStats(validatedStats);
          }
        } else {
          // ✅ Handle API errors gracefully without breaking the UI
          console.warn('Failed to fetch message stats:', response.status);
        }
      } catch (error) {
        // ✅ Log error but don&apos;t break the UI
        console.error('Error fetching message stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessageStats();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchMessageStats, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userRole = session.user.role as string;
  const navigation = getNavigationForRole(userRole);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Enhanced Mobile sidebar overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Enhanced Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out bg-white border-r border-gray-200",
        // Mobile styles
        isMobile && sidebarOpen && "w-80",
        isMobile && !sidebarOpen && "-translate-x-full w-80",
        // Desktop styles
        !isMobile && !sidebarCollapsed && "w-64",
        !isMobile && sidebarCollapsed && "w-16",
        // Tablet styles
        isTablet && "w-16"
      )}>
        
        {/* Enhanced Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          {(!sidebarCollapsed || isMobile) && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">OH</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">OliveHaus</h1>
                <p className="text-xs text-gray-500">PPMA System</p>
              </div>
            </div>
          )}
          
          {/* Enhanced Sidebar Controls */}
          <div className="flex items-center gap-2">
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Enhanced User Info */}
        {(!sidebarCollapsed || isMobile) && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {session.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session.user.email}
                </p>
                <Badge 
                  variant="secondary" 
                  className="mt-1 text-xs px-2 py-0.5"
                >
                  {userRole === "super_admin" ? "Admin" : userRole === "project_manager" ? "Manager" : "Client"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            if (!item.roles.includes(userRole)) return null;

            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                  sidebarCollapsed && !isMobile && "justify-center px-2"
                )}
                title={sidebarCollapsed && !isMobile ? item.name : undefined}
              >
                <item.icon className={cn(
                  "flex-shrink-0 h-5 w-5",
                  sidebarCollapsed && !isMobile ? "mx-auto" : "mr-3"
                )} />
                
                {(!sidebarCollapsed || isMobile) && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {/* ✅ FIXED: Safe navigation with optional chaining and defensive checks */}
                    {item.name === "Messages" && !loading && messageStats?.unreadCount && messageStats.unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {messageStats.unreadCount > 99 ? '99+' : messageStats.unreadCount}
                      </Badge>
                    )}
                  </>
                )}
                
                {/* ✅ FIXED: Collapsed state indicator with safe navigation */}
                {sidebarCollapsed && !isMobile && item.name === "Messages" && messageStats?.unreadCount && messageStats.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Enhanced Sidebar Footer */}
        {(!sidebarCollapsed || isMobile) && (
          <div className="p-4 border-t border-gray-200">
            <div className="space-y-2">
              <Link
                href={`${userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client"}/settings`}
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Main Content */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        !isMobile && !sidebarCollapsed && "ml-64",
        !isMobile && sidebarCollapsed && "ml-16",
        isTablet && "ml-16"
      )}>
        
        {/* Enhanced Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            
            {/* Left Section */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              
              {/* Enhanced Search */}
              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search projects, users, files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64 lg:w-80 focus:w-80 transition-all duration-200"
                  />
                </div>
              </form>
              
              {/* Mobile Search Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const query = prompt("Search for:");
                    if (query) {
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                    }
                  }}
                  className="p-2"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Notifications */}
              <NotificationBell />

              {/* Enhanced Profile Menu */}
              <div className="relative" data-profile-menu>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 sm:px-3"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {session.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </span>
                  </div>
                  
                  {!isMobile && (
                    <>
                      <div className="hidden sm:block text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {session.user.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {userRole === "super_admin" ? "Admin" : userRole === "project_manager" ? "Manager" : "Client"}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </>
                  )}
                </Button>

                {/* Enhanced Profile Dropdown */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {session.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {session.user.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {session.user.email}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href={`${userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client"}/profile`}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <User className="h-4 w-4" />
                        View Profile
                      </Link>
                      
                      <Link
                        href={`${userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client"}/settings`}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      
                      <div className="border-t border-gray-100 my-2"></div>
                      
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleSignOut();
                        }}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Enhanced Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}