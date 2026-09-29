import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "manager", "user", "viewer"]).default("user"),
});

export const GET = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  errorMessage: "Error fetching users",
  handler: async () => {
    // Get all users from database
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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

    // Sync with Clerk to get the latest user data
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 500 });

    // Create a map for quick lookup
    const clerkUserMap = new Map(
      clerkUsers.data.map((user) => [user.id, user]),
    );

    // Merge database users with Clerk data
    const enrichedUsers = users.map((dbUser) => {
      const clerkUser = clerkUserMap.get(dbUser.id);
      return {
        ...dbUser,
        // Update with latest Clerk data if available
        firstName: clerkUser?.firstName || dbUser.firstName,
        lastName: clerkUser?.lastName || dbUser.lastName,
        imageUrl: clerkUser?.imageUrl || dbUser.imageUrl,
        email: clerkUser?.primaryEmailAddress?.emailAddress || dbUser.email,
        lastSignIn: clerkUser?.lastSignInAt,
      };
    });

    return NextResponse.json(enrichedUsers);
  },
});

export const POST = apiRoute({
  auth: {
    permission: "manage_users",
    forbiddenMessage: "Forbidden - User management permission required",
  },
  errorMessage: "Error creating user",
  responseMessage: "Failed to create user",
  handler: async ({ request }) => {
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Create user in Clerk first
    const client = await clerkClient();
    let clerkUser;

    try {
      clerkUser = await client.users.createUser({
        emailAddress: [validatedData.email],
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
      });

      // Note: User created without password - they'll need to use "Forgot Password"
      // or admin can set password manually in Clerk dashboard
    } catch (clerkError: unknown) {
      console.error("Clerk user creation error:", clerkError);

      // Handle specific Clerk errors
      if (
        clerkError &&
        typeof clerkError === "object" &&
        "errors" in clerkError
      ) {
        const errorMessages = (clerkError.errors as Array<{ message: string }>)
          .map((err) => err.message)
          .join(", ");
        return NextResponse.json(
          { error: `Failed to create user in Clerk: ${errorMessages}` },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: "Failed to create user in authentication system" },
        { status: 400 },
      );
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        id: clerkUser.id,
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        imageUrl: clerkUser.imageUrl,
        role: validatedData.role,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        user,
        message:
          'User created successfully. They can use "Forgot Password" on the login page to set their password, or you can set it manually in the Clerk dashboard.',
      },
      {
        status: 201,
      },
    );
  },
});
