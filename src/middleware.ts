import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ["/login", "/api/auth"];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // If user is not authenticated and trying to access protected route
    if (!token && !isPublicRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // If user is authenticated and trying to access login page
    if (token && pathname === "/login") {
      // Redirect based on user role
      const redirectPath = getRoleBasedRedirect(token.role as string);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Role-based route protection
    if (token && !isPublicRoute) {
      const userRole = token.role as string;
      
      // Super Admin routes
      if (pathname.startsWith("/admin") && userRole !== "super_admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Project Manager routes
      if (pathname.startsWith("/manager") && userRole !== "project_manager" && userRole !== "super_admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Client routes
      if (pathname.startsWith("/client") && userRole !== "client" && userRole !== "super_admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // API route protection
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
        // Add role-based API access control here if needed
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