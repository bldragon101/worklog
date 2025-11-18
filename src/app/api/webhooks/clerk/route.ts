import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.error("CLERK_WEBHOOK_SECRET is not set");
}

export async function POST(request: NextRequest) {
  try {
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    const body = await request.text();
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 400 },
      );
    }

    const wh = new Webhook(webhookSecret);
    let evt;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const eventType = (evt as { type: string }).type;
    const { id, email_addresses, first_name, last_name, image_url } = (
      evt as {
        data: {
          id: string;
          email_addresses: { email_address: string }[];
          first_name: string | null;
          last_name: string | null;
          image_url: string | null;
        };
      }
    ).data;

    console.log(`Clerk webhook: ${eventType} for user ${id}`);

    // Determine user role based on environment variables
    const adminUsers = process.env.ADMIN_USER_IDS?.split(",") || [];
    const managerUsers = process.env.MANAGER_USER_IDS?.split(",") || [];
    const viewerUsers = process.env.VIEWER_USER_IDS?.split(",") || [];

    let role = "user"; // default
    if (adminUsers.includes(id)) {
      role = "admin";
    } else if (managerUsers.includes(id)) {
      role = "manager";
    } else if (viewerUsers.includes(id)) {
      role = "viewer";
    }

    switch (eventType) {
      case "user.created": {
        await prisma.user.upsert({
          where: { id },
          create: {
            id,
            email: email_addresses[0]?.email_address || "",
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
            role,
            isActive: true,
          },
          update: {
            email: email_addresses[0]?.email_address || "",
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
            // Don't override role on update - let admins manage it
            updatedAt: new Date(),
          },
        });

        // Sync role to Clerk's public metadata for immediate client access
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(id, {
            publicMetadata: {
              role,
            },
          });
        } catch (metadataError) {
          console.error(
            "Error updating Clerk metadata on user creation:",
            metadataError,
          );
        }
        break;
      }

      case "user.updated": {
        await prisma.user.upsert({
          where: { id },
          create: {
            id,
            email: email_addresses[0]?.email_address || "",
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
            role,
            isActive: true,
          },
          update: {
            email: email_addresses[0]?.email_address || "",
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
            updatedAt: new Date(),
          },
        });
        break;
      }

      case "user.deleted": {
        await prisma.user
          .update({
            where: { id },
            data: {
              isActive: false,
              updatedAt: new Date(),
            },
          })
          .catch(() => {
            // User might not exist in our database, that's okay
          });
        break;
      }

      case "session.created": {
        // Update last login time
        await prisma.user
          .update({
            where: { id },
            data: {
              lastLogin: new Date(),
              updatedAt: new Date(),
            },
          })
          .catch(() => {
            // User might not exist in our database yet
          });

        // Sync role to Clerk's public metadata on login for immediate access
        try {
          const user = await prisma.user.findUnique({
            where: { id },
            select: { role: true },
          });

          if (user?.role) {
            const client = await clerkClient();
            await client.users.updateUserMetadata(id, {
              publicMetadata: {
                role: user.role,
              },
            });
          }
        } catch (metadataError) {
          console.error(
            "Error updating Clerk metadata on session creation:",
            metadataError,
          );
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
