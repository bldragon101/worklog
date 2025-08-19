import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { z } from 'zod';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

// Validation schema for Google Drive settings
const googleDriveSettingsSchema = z.object({
  driveId: z.string().min(1, 'Drive ID is required'),
  driveName: z.string().min(1, 'Drive name is required'),
  baseFolderId: z.string().min(1, 'Base folder ID is required'),
  folderName: z.string().min(1, 'Folder name is required'),
  folderPath: z.array(z.string()),
  purpose: z.string().default('job_attachments')
});

// GET - Retrieve user's Google Drive settings
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
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
    const rateLimitResult = rateLimit(request);
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
    const rateLimitResult = rateLimit(request);
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