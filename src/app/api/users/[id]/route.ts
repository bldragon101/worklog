import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { z } from "zod";
import { apiRoute, stringIdParams } from "@/lib/api-route";

const updateUserSchema = z.object({
  role: z.enum(["admin", "manager", "user", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * Allow or block a user's sign-in in Clerk. Banning also revokes all of the
 * user's sessions.
 */
async function setClerkSignInAccess({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const client = await clerkClient();
  if (isActive) {
    await client.users.unbanUser(userId);
  } else {
    await client.users.banUser(userId);
  }
}

export const GET = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  params: stringIdParams(),
  errorMessage: "Error fetching user",
  handler: async ({ params: { id } }) => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get latest data from Clerk
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(id);
      const enrichedUser = {
        ...user,
        firstName: clerkUser.firstName || user.firstName,
        lastName: clerkUser.lastName || user.lastName,
        imageUrl: clerkUser.imageUrl || user.imageUrl,
        email: clerkUser.primaryEmailAddress?.emailAddress || user.email,
        lastSignIn: clerkUser.lastSignInAt,
      };

      return NextResponse.json(enrichedUser);
    } catch {
      // If Clerk user not found, return database user
      return NextResponse.json(user);
    }
  },
});

export const PATCH = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  params: stringIdParams(),
  errorMessage: "Error updating user",
  responseMessage: "Failed to update user",
  handler: async ({ request, userId, params: { id } }) => {
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    if (validatedData.isActive === false && id === userId) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 },
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Change sign-in access in Clerk before saving, so a failed ban or unban
    // leaves nothing half-applied. It runs whenever isActive is sent, not only
    // on a change, so resending the same value repairs an earlier mismatch.
    if (validatedData.isActive !== undefined) {
      try {
        await setClerkSignInAccess({
          userId: id,
          isActive: validatedData.isActive,
        });
      } catch (clerkError) {
        console.error(
          "Error updating user sign-in access in Clerk:",
          clerkError,
        );
        return NextResponse.json(
          {
            error: `Could not ${validatedData.isActive ? "reactivate" : "deactivate"} this user's sign-in. No changes were saved.`,
          },
          { status: 502 },
        );
      }
    }

    // Update user in database. If that fails after Clerk was changed, put
    // Clerk back to match the stored state so the two stay in agreement.
    const user = await prisma.user
      .update({
        where: { id },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
      })
      .catch(async (dbError: unknown) => {
        if (validatedData.isActive !== undefined) {
          await setClerkSignInAccess({
            userId: id,
            isActive: existingUser.isActive,
          }).catch((revertError: unknown) => {
            console.error(
              "Error restoring user sign-in access in Clerk:",
              revertError,
            );
          });
        }
        throw dbError;
      });

    // Update Clerk metadata and user fields
    try {
      const client = await clerkClient();

      // If role changed, update public metadata and revoke sessions
      if (validatedData.role !== undefined) {
        await client.users.updateUserMetadata(id, {
          publicMetadata: {
            role: validatedData.role,
          },
        });

        // CRITICAL: Revoke all sessions to force session claims refresh
        // This ensures the updated role is picked up immediately on next sign in
        try {
          const sessions = await client.sessions.getSessionList({ userId: id });
          for (const session of sessions.data) {
            await client.sessions.revokeSession(session.id);
          }
        } catch (sessionError) {
          console.error("Error revoking sessions:", sessionError);
          // Continue - metadata update was successful
        }
      }

      // If updating name fields, also update in Clerk
      if (
        validatedData.firstName !== undefined ||
        validatedData.lastName !== undefined
      ) {
        await client.users.updateUser(id, {
          firstName: validatedData.firstName || existingUser.firstName || "",
          lastName: validatedData.lastName || existingUser.lastName || "",
        });
      }
    } catch (clerkError) {
      console.error("Error updating user in Clerk:", clerkError);
      // Continue - database update was successful
    }

    return NextResponse.json(user);
  },
});

export const DELETE = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  params: stringIdParams(),
  errorMessage: "Error deleting user",
  responseMessage: "Failed to delete user",
  handler: async ({ params: { id } }) => {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete from Clerk first. A user already missing from Clerk can still be
    // removed here; any other failure keeps the record, marked inactive, so
    // a still-valid Clerk session cannot fall back to a default role.
    try {
      const client = await clerkClient();
      await client.users.deleteUser(id);
    } catch (clerkError) {
      const isAlreadyDeleted =
        isClerkAPIResponseError(clerkError) && clerkError.status === 404;
      if (!isAlreadyDeleted) {
        console.error("Error deleting user from Clerk:", clerkError);
        await prisma.user.update({
          where: { id },
          data: { isActive: false, updatedAt: new Date() },
        });
        return NextResponse.json(
          {
            error:
              "Could not delete this user's sign-in account. The user has been deactivated instead; try deleting again.",
          },
          { status: 502 },
        );
      }
    }

    // Delete from database
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "User deleted successfully" },
      {
        status: 200,
      },
    );
  },
});
