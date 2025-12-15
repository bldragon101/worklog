import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { z } from "zod";
// Specific rate limiting for settings operations
const settingsRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // Limit each IP to 30 requests per windowMs
  message: "Too many settings requests from this IP, please try again later",
});

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
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = settingsRateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
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

    return NextResponse.json(
      {
        success: true,
        settings: settings || null,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Failed to fetch Google Drive settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// POST - Save Google Drive settings
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = settingsRateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const body = await request.json();

    // Validate input data
    const validatedData = googleDriveSettingsSchema.parse(body);

    // Check user's role to determine if settings should be global
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      );
    }

    // Admin users automatically create global settings
    const shouldBeGlobal = user.role === "admin" || validatedData.isGlobal;

    // Check if user is admin when trying to create global settings
    if (shouldBeGlobal && user.role !== "admin") {
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

    return NextResponse.json(
      {
        success: true,
        settings: newSettings,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input data",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    console.error("Failed to save Google Drive settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// DELETE - Remove Google Drive settings
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = settingsRateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose") || "job_attachments";
    const isGlobal = searchParams.get("isGlobal") === "true";

    // Check if user is admin when trying to delete global settings
    if (isGlobal) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || user.role !== "admin") {
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

      return NextResponse.json(
        {
          success: true,
          deactivated: updatedSettings.count,
        },
        {
          headers: rateLimitResult.headers,
        },
      );
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

    return NextResponse.json(
      {
        success: true,
        deactivated: updatedSettings.count,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Failed to deactivate Google Drive settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
