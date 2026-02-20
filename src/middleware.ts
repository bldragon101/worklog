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
  "/api/admin/sign-up-status",
]);

const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"]);

// Define protected routes that require specific permissions
const isPayrollRoute = createRouteMatcher(["/payroll(.*)"]);
const isRCTIRoute = createRouteMatcher(["/rcti(.*)"]);
const isAdminSettingsRoute = createRouteMatcher(["/settings/admin(.*)"]);
const isUsersRoute = createRouteMatcher(["/settings/users(.*)"]);
const isHistoryRoute = createRouteMatcher(["/settings/history(.*)"]);
const isSettingsRoute = createRouteMatcher(["/settings(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    if (isSignUpRoute(req)) {
      try {
        const statusUrl = new URL("/api/admin/sign-up-status", req.url);
        const statusRes = await fetch(statusUrl, {
          cache: "no-store",
        });
        if (!statusRes.ok) {
          throw new Error(`Sign-up status check failed: ${statusRes.status}`);
        }
        const data = await statusRes.json();
        if (data.error) {
          console.error("Sign-up status check returned error:", data.error);
        } else if (!data.enabled) {
          return NextResponse.redirect(new URL("/sign-in", req.url));
        }
      } catch (error) {
        console.error("Error checking sign-up status:", error);
      }
    }
    return NextResponse.next();
  }

  // Check authentication and redirect to custom sign-in if not authenticated
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get user role from Clerk's public metadata (no API call needed)
  // Clerk automatically exposes user.public_metadata in sessionClaims.publicMetadata
  // No custom session token template configuration required!
  //
  // Note: Session token updates happen on next sign-in, not immediately when publicMetadata changes.
  // For real-time role updates, consider:
  // - Use Clerk webhooks (user.updated) to trigger session refresh
  // - Accept eventual consistency (users see new role after next sign-in)
  // - Keep clerkClient().users.getUser() calls if immediate updates are critical (adds latency)
  const publicMetadata = sessionClaims?.publicMetadata as
    | { role?: string }
    | undefined;
  let userRole = publicMetadata?.role;

  // Fallback to environment variables if role not in session
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

  // Admin settings and integrations - requires admin role
  if (isAdminSettingsRoute(req) && userRole !== "admin") {
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
