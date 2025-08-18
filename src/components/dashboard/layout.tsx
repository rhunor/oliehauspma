// src/components/dashboard/layout.tsx - COMPLETE FIXED VERSION
"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronRight,
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
  badge?: number;
}

interface MessageStats {
  unreadCount: number;
}

interface ViewportState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// Default message stats to prevent undefined errors
const DEFAULT_MESSAGE_STATS: MessageStats = {
  unreadCount: 0
};

// Enhanced breakpoint system following mobile-first approach
const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  xl: 1280,
  xxl: 1536
} as const;

// Enhanced navigation with proper role-based routing and responsive considerations
const getNavigationForRole = (userRole: string, messageStats: MessageStats): NavItem[] => {
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

// Custom hook for responsive viewport management
const useViewport = () => {
  const [viewport, setViewport] = useState<ViewportState>({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false
  });

  const updateViewport = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setViewport({
      width,
      height,
      isMobile: width < BREAKPOINTS.tablet,
      isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
      isDesktop: width >= BREAKPOINTS.desktop
    });
  }, []);

  useEffect(() => {
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [updateViewport]);

  return viewport;
};

// Main Dashboard Layout Component
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const viewport = useViewport();

  // State management
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageStats, setMessageStats] = useState<MessageStats>(DEFAULT_MESSAGE_STATS);

  // Fetch message stats
  useEffect(() => {
    const fetchMessageStats = async () => {
      try {
        const response = await fetch('/api/messages/stats');
        if (response.ok) {
          const data = await response.json();
          setMessageStats(data);
        }
      } catch (error) {
        console.error('Error fetching message stats:', error);
      }
    };

    if (session?.user) {
      fetchMessageStats();
    }
  }, [session]);

  // Responsive sidebar management
  useEffect(() => {
    if (viewport.isMobile && sidebarOpen) {
      // Keep mobile sidebar behavior as overlay
      return;
    }
    
    if (viewport.isTablet) {
      // Auto-collapse on tablet for more space
      setSidebarCollapsed(true);
      setSidebarOpen(false);
    }
    
    if (viewport.isDesktop) {
      // Expand sidebar on desktop
      setSidebarCollapsed(false);
      setSidebarOpen(false);
    }
  }, [viewport.isMobile, viewport.isTablet, viewport.isDesktop, sidebarOpen]);

  // Close mobile menu when route changes
  useEffect(() => {
    if (viewport.isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, viewport.isMobile]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut({ redirect: false });
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [router]);

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }, [router, searchQuery]);

  // CRITICAL FIX: Get role-specific settings route
  const getSettingsRoute = useCallback((userRole: string) => {
    switch (userRole) {
      case "super_admin":
        return "/admin/settings";
      case "project_manager":
        return "/manager/settings";
      case "client":
        return "/client/settings";
      default:
        return "/login";
    }
  }, []);

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userRole = session.user.role as string;
  const navigation = getNavigationForRole(userRole, messageStats);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay with proper z-index */}
      {sidebarOpen && viewport.isMobile && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Enhanced Sidebar with responsive design */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out bg-white border-r border-gray-200 shadow-lg",
        // Mobile styles - full overlay
        viewport.isMobile && sidebarOpen && "w-80 translate-x-0",
        viewport.isMobile && !sidebarOpen && "w-80 -translate-x-full",
        // Tablet styles - collapsed by default
        viewport.isTablet && "w-16",
        // Desktop styles - expandable
        viewport.isDesktop && !sidebarCollapsed && "w-64",
        viewport.isDesktop && sidebarCollapsed && "w-16"
      )}>
        
        {/* Enhanced Sidebar Header with responsive logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 bg-white">
          {((!sidebarCollapsed && viewport.isDesktop) || viewport.isMobile) && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">OH</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">OliveHaus</h1>
                <p className="text-xs text-gray-500 truncate">PPMA System</p>
              </div>
            </div>
          )}
          
          {/* Sidebar Controls with improved touch targets */}
          <div className="flex items-center gap-2">
            {viewport.isDesktop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-100 rounded-md"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {viewport.isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-md"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Enhanced User Info with responsive design */}
        {((!sidebarCollapsed && viewport.isDesktop) || viewport.isMobile) && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
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

        {/* Enhanced Navigation with improved touch targets and accessibility */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-mobile">
          {navigation.map((item) => {
            if (!item.roles.includes(userRole)) return null;

            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 relative",
                  "min-h-[44px] touch-manipulation", // Improved touch targets
                  isActive
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                  sidebarCollapsed && viewport.isDesktop && "justify-center px-2"
                )}
                onClick={() => viewport.isMobile && setSidebarOpen(false)}
              >
                <item.icon className={cn(
                  "flex-shrink-0 transition-colors duration-200",
                  sidebarCollapsed && viewport.isDesktop ? "h-5 w-5" : "h-5 w-5 mr-3",
                  isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"
                )} />
                
                {((!sidebarCollapsed && viewport.isDesktop) || viewport.isMobile) && (
                  <>
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <Badge 
                        variant={isActive ? "secondary" : "default"}
                        className="ml-2 h-5 px-2 text-xs"
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                  </>
                )}
                
                {sidebarCollapsed && viewport.isDesktop && item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Enhanced Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 bg-white">
          {((!sidebarCollapsed && viewport.isDesktop) || viewport.isMobile) ? (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-700 hover:bg-gray-100 min-h-[44px]"
                onClick={() => {
                  const settingsRoute = getSettingsRoute(userRole);
                  router.push(settingsRoute);
                  if (viewport.isMobile) setSidebarOpen(false);
                }}
              >
                <Settings className="h-4 w-4 mr-3" />
                <span>Settings</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-600 hover:bg-red-50 min-h-[44px]"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-3" />
                <span>Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full p-2 text-gray-700 hover:bg-gray-100 min-h-[44px]"
                onClick={() => {
                  const settingsRoute = getSettingsRoute(userRole);
                  router.push(settingsRoute);
                }}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full p-2 text-red-600 hover:bg-red-50 min-h-[44px]"
                onClick={handleSignOut}
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area with responsive margins */}
      <div className={cn(
        "flex flex-col flex-1 overflow-hidden transition-all duration-300",
        viewport.isMobile && "ml-0",
        viewport.isTablet && "ml-16",
        viewport.isDesktop && !sidebarCollapsed && "ml-64",
        viewport.isDesktop && sidebarCollapsed && "ml-16"
      )}>
        
        {/* Enhanced Header with responsive design */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
          {/* Mobile menu button and search */}
          <div className="flex items-center gap-4 flex-1">
            {viewport.isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-md"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            {/* Enhanced Search with responsive width */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search projects, files..."
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors min-h-[44px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>

          {/* Header Actions with improved spacing */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell />
            
            {/* CRITICAL FIX: Profile Menu with enhanced mobile support */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-md min-h-[44px]"
                aria-expanded={showProfileMenu}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-xs">
                    {session.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                </div>
                {!viewport.isMobile && (
                  <>
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                      {session.user.name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </>
                )}
              </Button>

              {/* CRITICAL FIX: Profile Dropdown with proper routing */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        const settingsRoute = getSettingsRoute(userRole);
                        router.push(settingsRoute);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors min-h-[44px]"
                    >
                      <User className="h-4 w-4 mr-3" />
                      Profile & Settings
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleSignOut();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content with proper responsive padding */}
        <main className="flex-1 overflow-auto bg-gray-50 px-4 sm:px-6 lg:px-8 py-6 mobile-safe-bottom">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Click outside handler for profile menu */}
      {showProfileMenu && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setShowProfileMenu(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}