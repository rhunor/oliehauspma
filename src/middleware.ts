// src/middleware.ts - ENHANCED WITH SESSION PERSISTENCE AND SMART REDIRECTS
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const { pathname, search } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ["/login", "/api/auth", "/unauthorized"];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // If user is not authenticated and trying to access protected route
    if (!token && !isPublicRoute) {
      // Store the intended destination for post-login redirect
      const redirectUrl = new URL("/login", request.url);
      if (pathname !== "/" && !pathname.startsWith("/api/")) {
        redirectUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
      }
      return NextResponse.redirect(redirectUrl);
    }

    // If user is authenticated and trying to access login page
    if (token && pathname === "/login") {
      // Check for callback URL from query params
      const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
      
      if (callbackUrl && callbackUrl.startsWith("/")) {
        // Validate the callback URL is for this user's role
        const userRole = token.role as string;
        const allowedPaths = getAllowedPathsForRole(userRole);
        
        if (allowedPaths.some(path => callbackUrl.startsWith(path))) {
          return NextResponse.redirect(new URL(callbackUrl, request.url));
        }
      }
      
      // Default redirect based on role
      const redirectPath = getRoleBasedRedirect(token.role as string);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Role-based route protection with enhanced logic
    if (token && !isPublicRoute) {
      const userRole = token.role as string;
      
      // Enhanced route mappings with hierarchical access
      const roleRoutes: Record<string, string[]> = {
        super_admin: ["/admin", "/manager", "/client"], // Can access all
        project_manager: [
          "/manager", 
          "/admin/projects", 
          "/admin/site-schedule", 
          "/admin/messages", 
          "/admin/analytics", 
          "/admin/files", 
          "/admin/calendar"
        ],
        client: [
          "/client", 
          "/admin/projects", 
          "/admin/site-schedule", 
          "/admin/messages", 
          "/admin/files", 
          "/admin/calendar"
        ]
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
      const adminOnlyRoutes = ["/admin/users", "/admin/system", "/admin/settings"];
      if (adminOnlyRoutes.some(route => pathname.startsWith(route)) && userRole !== "super_admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Check general route access
      const allowedRoutes = roleRoutes[userRole] || [];
      const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));
      
      if (!hasAccess && !pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // API route protection with enhanced headers
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
        const response = NextResponse.next();
        response.headers.set("x-user-role", userRole);
        response.headers.set("x-user-id", token.id as string);
        response.headers.set("x-user-email", token.email as string);
        
        // Add session timestamp for debugging
        response.headers.set("x-session-timestamp", new Date().toISOString());
        
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

function getAllowedPathsForRole(role: string): string[] {
  switch (role) {
    case "super_admin":
      return ["/admin", "/manager", "/client"];
    case "project_manager":
      return ["/manager", "/admin/projects", "/admin/site-schedule", "/admin/messages", "/admin/files", "/admin/calendar"];
    case "client":
      return ["/client", "/admin/projects", "/admin/site-schedule", "/admin/messages", "/admin/files", "/admin/calendar"];
    default:
      return [];
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
     * - api/auth (NextAuth API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};