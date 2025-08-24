import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';
// Specific rate limiting for settings operations
const settingsRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // Limit each IP to 20 requests per windowMs
  message: 'Too many settings requests from this IP, please try again later'
});

// Google Drive ID validation pattern (alphanumeric, hyphens, underscores)
const GOOGLE_DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/;

// Enhanced validation schema for Google Drive settings with security checks
const googleDriveSettingsSchema = z.object({
  driveId: z.string()
    .min(1, 'Drive ID is required')
    .max(256, 'Drive ID too long')
    .regex(GOOGLE_DRIVE_ID_PATTERN, 'Invalid Google Drive ID format'),
  driveName: z.string()
    .min(1, 'Drive name is required')
    .max(255, 'Drive name too long')
    .trim(),
  baseFolderId: z.string()
    .min(1, 'Base folder ID is required')
    .max(256, 'Base folder ID too long')
    .regex(GOOGLE_DRIVE_ID_PATTERN, 'Invalid folder ID format'),
  folderName: z.string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name too long')
    .trim(),
  folderPath: z.array(z.string().max(255).trim())
    .max(10, 'Folder path too deep'),
  purpose: z.string()
    .max(50, 'Purpose too long')
    .default('job_attachments')
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
    const purpose = searchParams.get('purpose') || 'job_attachments';

    // Get active settings for the user and purpose
    const settings = await prisma.googleDriveSettings.findFirst({
      where: {
        userId: userId,
        purpose: purpose,
        isActive: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      settings: settings || null
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Failed to fetch Google Drive settings:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
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

    // Deactivate any existing active settings for this purpose
    await prisma.googleDriveSettings.updateMany({
      where: {
        userId: userId,
        purpose: validatedData.purpose,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

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
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      settings: newSettings
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Failed to save Google Drive settings:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
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
    const purpose = searchParams.get('purpose') || 'job_attachments';

    // Deactivate settings for this purpose
    const updatedSettings = await prisma.googleDriveSettings.updateMany({
      where: {
        userId: userId,
        purpose: purpose,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    return NextResponse.json({
      success: true,
      deactivated: updatedSettings.count
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Failed to deactivate Google Drive settings:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}