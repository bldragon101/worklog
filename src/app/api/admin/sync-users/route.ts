import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  errorMessage: "Error syncing users",
  responseMessage: "Failed to sync users",
  handler: async () => {
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 500 });

    let syncedCount = 0;
    let errorCount = 0;

    // Determine roles from environment variables
    const adminUsers = process.env.ADMIN_USER_IDS?.split(",") || [];
    const managerUsers = process.env.MANAGER_USER_IDS?.split(",") || [];
    const viewerUsers = process.env.VIEWER_USER_IDS?.split(",") || [];

    for (const clerkUser of clerkUsers.data) {
      try {
        // Determine role
        let role = "user"; // default
        if (adminUsers.includes(clerkUser.id)) {
          role = "admin";
        } else if (managerUsers.includes(clerkUser.id)) {
          role = "manager";
        } else if (viewerUsers.includes(clerkUser.id)) {
          role = "viewer";
        }

        // Use transaction to handle race conditions and ensure data consistency
        await prisma.$transaction(async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: { id: clerkUser.id },
          });

          if (existingUser) {
            // Update existing user but preserve role unless it's from env vars
            const shouldUpdateRole =
              adminUsers.includes(clerkUser.id) ||
              managerUsers.includes(clerkUser.id) ||
              viewerUsers.includes(clerkUser.id);

            await tx.user.update({
              where: { id: clerkUser.id },
              data: {
                email: clerkUser.primaryEmailAddress?.emailAddress || "",
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                ...(shouldUpdateRole && { role }), // Only update role if user is in env vars
                updatedAt: new Date(),
              },
            });
          } else {
            // Create new user with determined role
            await tx.user.create({
              data: {
                id: clerkUser.id,
                email: clerkUser.primaryEmailAddress?.emailAddress || "",
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                role,
                isActive: true,
              },
            });
          }
        });

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing user ${clerkUser.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      message: "User sync completed",
      syncedCount,
      errorCount,
      totalClerkUsers: clerkUsers.data.length,
    });
  },
});
