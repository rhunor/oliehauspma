// src/components/dashboard/layout.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Menu, 
  X, 
  Bell, 
  Settings, 
  LogOut, 
  User,
  Search,
  ChevronDown,
  Home,
  Users,
  FolderOpen,
  CheckSquare,
  MessageSquare,
  BarChart,
  FileText,
  Calendar,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge, CountBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  roles: string[];
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: Home,
    roles: ["super_admin", "project_manager", "client"],
  },
  {
    name: "Projects",
    href: "/admin/projects",
    icon: FolderOpen,
    roles: ["super_admin", "project_manager", "client"],
  },
  {
    name: "Tasks",
    href: "/admin/tasks",
    icon: CheckSquare,
    roles: ["super_admin", "project_manager", "client"],
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: Users,
    roles: ["super_admin"],
  },
  {
    name: "Messages",
    href: "/admin/messages",
    icon: MessageSquare,
    badge: 3,
    roles: ["super_admin", "project_manager", "client"],
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
    roles: ["super_admin", "project_manager"],
  },
  {
    name: "Files",
    href: "/admin/files",
    icon: FileText,
    roles: ["super_admin", "project_manager", "client"],
  },
  {
    name: "Calendar",
    href: "/admin/calendar",
    icon: Calendar,
    roles: ["super_admin", "project_manager", "client"],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [notifications] = useState(5);
  const { data: session } = useSession();
  const pathname = usePathname();

  // Close mobile sidebar and search on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
    setIsMobileSearchOpen(false);
    setIsProfileMenuOpen(false);
  }, [pathname]);

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(session?.user?.role || "")
  );

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop Top Navigation Bar */}
      <nav className="hidden lg:block bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-40">
        <div className="px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-gray-900">OliveHaus</h1>
                <p className="text-xs text-neutral-500">PPMA</p>
              </div>
            </Link>

            {/* Desktop Navigation Links - Compact */}
            <div className="flex items-center space-x-1 flex-1 justify-center max-w-4xl">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1 px-2 py-2 rounded-md text-sm font-medium transition-colors relative",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary-600" : "text-neutral-400"
                    )} />
                    <span className="hidden xl:inline">{item.name}</span>
                    {item.badge && (
                      <CountBadge count={item.badge} className="ml-1" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side actions - Fixed width */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Search */}
              <div className="relative hidden xl:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="pl-10 pr-4 w-48"
                  inputSize="sm"
                />
              </div>

              {/* Search Icon for smaller desktop screens */}
              <Button variant="ghost" size="icon" className="xl:hidden">
                <Search className="h-4 w-4" />
              </Button>

              {/* Notifications */}
              <div className="relative">
                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>
                {notifications > 0 && (
                  <CountBadge
                    count={notifications}
                    className="absolute -top-1 -right-1"
                  />
                )}
              </div>

              {/* Profile dropdown - Always visible */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                >
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {session?.user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left hidden 2xl:block">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-24">
                      {session?.user?.name?.split(' ')[0]}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {session?.user?.role?.replace("_", " ")}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {/* Desktop Profile dropdown menu */}
                {isProfileMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <Card className="absolute right-0 mt-2 w-56 py-2 shadow-lg z-50">
                      <div className="px-4 py-2 border-b border-neutral-200">
                        <p className="text-sm font-medium text-gray-900">
                          {session?.user?.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {session?.user?.email}
                        </p>
                        <Badge variant="outline" size="sm" className="mt-1">
                          {session?.user?.role?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="py-1">
                        <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                          <User className="h-4 w-4" />
                          Profile
                        </button>
                        <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                          <Settings className="h-4 w-4" />
                          Settings
                        </button>
                        <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                          <HelpCircle className="h-4 w-4" />
                          Help & Support
                        </button>
                        <div className="border-t border-neutral-200 my-1" />
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-40">
        <div className="px-4">
          <div className="flex justify-between items-center h-16">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-gray-900">OliveHaus</h1>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {/* Mobile Search - Conditional */}
              {isMobileSearchOpen ? (
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      type="search"
                      placeholder="Search..."
                      className="pl-10 pr-4"
                      inputSize="sm"
                      autoFocus
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsMobileSearchOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile Search Button */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsMobileSearchOpen(true)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  
                  {/* Mobile Notifications */}
                  <div className="relative">
                    <Button variant="ghost" size="icon">
                      <Bell className="h-5 w-5" />
                    </Button>
                    {notifications > 0 && (
                      <CountBadge
                        count={notifications}
                        className="absolute -top-1 -right-1"
                      />
                    )}
                  </div>
                  
                  {/* Mobile Profile */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    >
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {session?.user?.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </Button>

                    {/* Mobile Profile dropdown menu */}
                    {isProfileMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsProfileMenuOpen(false)}
                        />
                        <Card className="absolute right-0 mt-2 w-56 py-2 shadow-lg z-50">
                          <div className="px-4 py-2 border-b border-neutral-200">
                            <p className="text-sm font-medium text-gray-900">
                              {session?.user?.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {session?.user?.email}
                            </p>
                            <Badge variant="outline" size="sm" className="mt-1">
                              {session?.user?.role?.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="py-1">
                            <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                              <User className="h-4 w-4" />
                              Profile
                            </button>
                            <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                              <Settings className="h-4 w-4" />
                              Settings
                            </button>
                            <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-neutral-50">
                              <HelpCircle className="h-4 w-4" />
                              Help & Support
                            </button>
                            <div className="border-t border-neutral-200 my-1" />
                            <button
                              onClick={handleSignOut}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign out
                            </button>
                          </div>
                        </Card>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Mobile Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-gray-900">OliveHaus</h1>
                <p className="text-xs text-neutral-500">PPMA</p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                  onClick={() => setIsMobileSidebarOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-primary-600" : "text-neutral-400"
                    )} />
                    {item.name}
                  </div>
                  {item.badge && (
                    <CountBadge count={item.badge} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile User Profile */}
          <div className="p-4 border-t border-neutral-200">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {session?.user?.role?.replace("_", " ")}
                </p>
              </div>
              <LogOut className="h-4 w-4 text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="w-full">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}