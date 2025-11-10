import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
]);

// Define protected routes that require specific permissions
const isPayrollRoute = createRouteMatcher(["/payroll(.*)"]);
const isRCTIRoute = createRouteMatcher(["/rcti(.*)"]);
const isIntegrationsRoute = createRouteMatcher(["/integrations(.*)"]);
const isUsersRoute = createRouteMatcher(["/settings/users(.*)"]);
const isHistoryRoute = createRouteMatcher(["/settings/history(.*)"]);
const isSettingsRoute = createRouteMatcher(["/settings(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Check authentication and redirect to custom sign-in if not authenticated
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get user role from Clerk's public metadata or fallback to environment variables
  const publicMetadata = sessionClaims?.publicMetadata as
    | { role?: string }
    | undefined;
  let userRole = publicMetadata?.role;

  // If role is not in metadata, determine from environment variables
  if (!userRole) {
    const adminUsers = process.env.ADMIN_USER_IDS?.split(",") || [];
    const managerUsers = process.env.MANAGER_USER_IDS?.split(",") || [];
    const viewerUsers = process.env.VIEWER_USER_IDS?.split(",") || [];

    if (adminUsers.includes(userId)) {
      userRole = "admin";
    } else if (managerUsers.includes(userId)) {
      userRole = "manager";
    } else if (viewerUsers.includes(userId)) {
      userRole = "viewer";
    } else {
      userRole = "user";
    }
  }

  // Check permissions for protected routes
  // Payroll - requires admin role
  if (isPayrollRoute(req) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  // RCTI - requires admin role
  if (isRCTIRoute(req) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  // Integrations - requires admin role (manage_integrations permission)
  if (isIntegrationsRoute(req) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  // Users - requires admin role (manage_users permission)
  if (isUsersRoute(req) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  // History - requires admin role (view_history permission)
  if (isHistoryRoute(req) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  // Settings - requires admin or manager role (access_settings permission)
  if (isSettingsRoute(req) && userRole !== "admin" && userRole !== "manager") {
    return NextResponse.redirect(new URL("/overview?access=denied", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
