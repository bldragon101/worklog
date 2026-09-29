import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

/**
 * Only available in development, to users who may manage users
 */
async function requireDevelopmentUserManager() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Only available in development" },
      { status: 403 },
    );
  }

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  if (!(await checkPermission("manage_users"))) {
    return NextResponse.json(
      { error: "Forbidden - User management permission required" },
      { status: 403 },
    );
  }

  return authResult;
}

export const POST = apiRoute({
  auth: requireDevelopmentUserManager,
  errorMessage: "Error creating test user",
  responseMessage: "Failed to create test user",
  handler: async () => {
    // Create a test user in database only (not Clerk)
    const testUser = await prisma.user.create({
      data: {
        id: `test_${Date.now()}`,
        email: `testuser${Date.now()}@example.com`,
        firstName: "Test",
        lastName: "User",
        role: "user",
        isActive: true,
      },
    });

    return NextResponse.json({
      message: "Test user created",
      user: testUser,
    });
  },
});
