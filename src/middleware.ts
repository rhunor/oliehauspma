// src/middleware.ts - FIXED VERSION WITH PROPER ROLE-BASED ROUTING
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ["/login", "/api/auth", "/unauthorized"];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // If user is not authenticated and trying to access protected route
    if (!token && !isPublicRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // If user is authenticated and trying to access login page
    if (token && pathname === "/login") {
      const redirectPath = getRoleBasedRedirect(token.role as string);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Role-based route protection with proper role hierarchy
    if (token && !isPublicRoute) {
      const userRole = token.role as string;
      
      // Route mappings based on role
      const roleRoutes: Record<string, string[]> = {
        super_admin: ["/admin", "/manager", "/client"], // Can access all
        project_manager: ["/manager", "/admin/projects", "/admin/site-schedule", "/admin/messages", "/admin/analytics", "/admin/files", "/admin/calendar"],
        client: ["/client", "/admin/projects", "/admin/site-schedule", "/admin/messages", "/admin/files", "/admin/calendar"]
      };

      // Check if user is trying to access a role-specific dashboard root
      if (pathname === "/admin" && userRole !== "super_admin") {
        return NextResponse.redirect(new URL(getRoleBasedRedirect(userRole), request.url));
      }
      
      if (pathname === "/manager" && userRole !== "project_manager" && userRole !== "super_admin") {
        return NextResponse.redirect(new URL(getRoleBasedRedirect(userRole), request.url));
      }
      
      if (pathname === "/client" && userRole !== "client" && userRole !== "super_admin") {
        return NextResponse.redirect(new URL(getRoleBasedRedirect(userRole), request.url));
      }

      // Special restrictions for admin-only routes
      const adminOnlyRoutes = ["/admin/users"];
      if (adminOnlyRoutes.some(route => pathname.startsWith(route)) && userRole !== "super_admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // For shared routes like /admin/projects, /admin/messages, etc., allow based on role
      const allowedRoutes = roleRoutes[userRole] || [];
      const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));
      
      if (!hasAccess && !pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // API route protection with role and user ID headers
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
        const response = NextResponse.next();
        response.headers.set("x-user-role", userRole);
        response.headers.set("x-user-id", token.id as string);
        return response;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow access to public routes
        const publicRoutes = ["/login", "/api/auth", "/unauthorized"];
        if (publicRoutes.some(route => pathname.startsWith(route))) {
          return true;
        }

        // Require authentication for all other routes
        return !!token;
      },
    },
  }
);

function getRoleBasedRedirect(role: string): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "project_manager":
      return "/manager";
    case "client":
      return "/client";
    default:
      return "/login";
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};