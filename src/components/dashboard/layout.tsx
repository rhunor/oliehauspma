// src/components/dashboard/layout.tsx - UPDATED WITH REAL NOTIFICATIONS AND ROLE-BASED ROUTING
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
  Calendar
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

// Updated navigation with proper role-based routing
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
    commonRoutes.splice(3, 0, {
      name: "Users",
      href: "/admin/users",
      icon: Users,
      roles: ["super_admin"],
    });
    commonRoutes.splice(5, 0, {
      name: "Analytics",
      href: "/admin/analytics",
      icon: BarChart,
      roles: ["super_admin"],
    });
  } else if (userRole === "project_manager") {
    commonRoutes.splice(4, 0, {
      name: "Analytics",
      href: "/manager/analytics",
      icon: BarChart,
      roles: ["project_manager"],
    });
  }

  return commonRoutes;
};

interface MessageStats {
  unreadCount: number;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [messageStats, setMessageStats] = useState<MessageStats>({ unreadCount: 0 });
  const [loading, setLoading] = useState(true);

  const userRole = session?.user?.role || "client";
  const navigation = getNavigationForRole(userRole);

  // Fetch real message statistics
  useEffect(() => {
    const fetchMessageStats = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch('/api/messages/stats');
        if (response.ok) {
          const data = await response.json();
          setMessageStats(data);
        }
      } catch (error) {
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

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const baseRoute = userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client";
      router.push(`${baseRoute}/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
        
        {/* Mobile sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary-600">OliveHaus</span>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <nav className="mt-4 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-100 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  {item.name === "Messages" && !loading && messageStats.unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {messageStats.unreadCount > 99 ? '99+' : messageStats.unreadCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:w-64 lg:flex lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary-600">OliveHaus PPMA</span>
          </div>
          
          <div className="flex-1 flex flex-col pt-4 pb-4 overflow-y-auto">
            <nav className="flex-1 px-4 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/" && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-100 text-primary-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                    {item.name === "Messages" && !loading && messageStats.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {messageStats.unreadCount > 99 ? '99+' : messageStats.unreadCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden sm:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search projects, users, files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </form>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <NotificationBell />

              {/* Profile menu */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {session?.user?.name}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <Link
                      href={`${userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client"}/profile`}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link
                      href={`${userRole === "super_admin" ? "/admin" : userRole === "project_manager" ? "/manager" : "/client"}/settings`}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}