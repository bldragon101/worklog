import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserRole } from "@/lib/permissions";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";
// Google Drive ID validation pattern (alphanumeric, hyphens, underscores)
const GOOGLE_DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/;

// Enhanced validation schema for Google Drive settings with security checks
const googleDriveSettingsSchema = z.object({
  driveId: z
    .string()
    .min(1, "Drive ID is required")
    .max(256, "Drive ID too long")
    .regex(GOOGLE_DRIVE_ID_PATTERN, "Invalid Google Drive ID format"),
  driveName: z
    .string()
    .min(1, "Drive name is required")
    .max(255, "Drive name too long")
    .trim(),
  baseFolderId: z
    .string()
    .min(1, "Base folder ID is required")
    .max(256, "Base folder ID too long")
    .regex(GOOGLE_DRIVE_ID_PATTERN, "Invalid folder ID format"),
  folderName: z
    .string()
    .min(1, "Folder name is required")
    .max(255, "Folder name too long")
    .trim(),
  folderPath: z
    .array(z.string().max(255).trim())
    .max(10, "Folder path too deep"),
  purpose: z.string().max(50, "Purpose too long").default("job_attachments"),
  isGlobal: z.boolean().default(false),
});

// GET - Retrieve user's Google Drive settings
export const GET = apiRoute({
  rateLimit: "settings",
  auth: "user",
  errorMessage: "Failed to fetch Google Drive settings",
  errorBody: { success: false },
  handler: async ({ request, userId }) => {
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose") || "job_attachments";

    // Get active settings - prioritize global settings, fallback to user-specific
    const settings = await prisma.googleDriveSettings.findFirst({
      where: {
        AND: [
          { purpose: purpose },
          { isActive: true },
          {
            OR: [{ isGlobal: true }, { userId: userId, isGlobal: false }],
          },
        ],
      },
      orderBy: [
        { isGlobal: "desc" }, // Global settings first
        { updatedAt: "desc" }, // Then by most recent
      ],
    });

    return NextResponse.json({
      success: true,
      settings: settings || null,
    });
  },
});

// POST - Save Google Drive settings
export const POST = apiRoute({
  rateLimit: "settings",
  auth: "user",
  errorMessage: "Failed to save Google Drive settings",
  validationMessage: "Invalid input data",
  errorBody: { success: false },
  handler: async ({ request, userId }) => {
    const body = await request.json();

    // Validate input data
    const validatedData = googleDriveSettingsSchema.parse(body);

    // Check user's role to determine if settings should be global
    const role = await getUserRole(userId);

    // Admin users automatically create global settings
    const shouldBeGlobal = role === "admin" || validatedData.isGlobal;

    // Check if user is admin when trying to create global settings
    if (shouldBeGlobal && role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only administrators can create global settings",
        },
        { status: 403 },
      );
    }

    if (shouldBeGlobal) {
      // Deactivate any existing global settings for this purpose
      await prisma.googleDriveSettings.updateMany({
        where: {
          isGlobal: true,
          purpose: validatedData.purpose,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    } else {
      // Deactivate any existing user-specific active settings for this purpose
      await prisma.googleDriveSettings.updateMany({
        where: {
          userId: userId,
          purpose: validatedData.purpose,
          isActive: true,
          isGlobal: false,
        },
        data: {
          isActive: false,
        },
      });
    }

    // Create new settings record
    const newSettings = await prisma.googleDriveSettings.create({
      data: {
        userId: userId,
        driveId: validatedData.driveId,
        driveName: validatedData.driveName,
        baseFolderId: validatedData.baseFolderId,
        folderName: validatedData.folderName,
        folderPath: validatedData.folderPath,
        purpose: validatedData.purpose,
        isActive: true,
        isGlobal: shouldBeGlobal,
      },
    });

    return NextResponse.json({
      success: true,
      settings: newSettings,
    });
  },
});

// DELETE - Remove Google Drive settings
export const DELETE = apiRoute({
  rateLimit: "settings",
  auth: "user",
  errorMessage: "Failed to deactivate Google Drive settings",
  errorBody: { success: false },
  handler: async ({ request, userId }) => {
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose") || "job_attachments";
    const isGlobal = searchParams.get("isGlobal") === "true";

    // Check if user is admin when trying to delete global settings
    if (isGlobal) {
      const role = await getUserRole(userId);

      if (role !== "admin") {
        return NextResponse.json(
          {
            success: false,
            error: "Only administrators can delete global settings",
          },
          { status: 403 },
        );
      }

      // Deactivate global settings for this purpose
      const updatedSettings = await prisma.googleDriveSettings.updateMany({
        where: {
          isGlobal: true,
          purpose: purpose,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({
        success: true,
        deactivated: updatedSettings.count,
      });
    }

    // Deactivate user-specific settings for this purpose
    const updatedSettings = await prisma.googleDriveSettings.updateMany({
      where: {
        userId: userId,
        purpose: purpose,
        isActive: true,
        isGlobal: false,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      deactivated: updatedSettings.count,
    });
  },
});
