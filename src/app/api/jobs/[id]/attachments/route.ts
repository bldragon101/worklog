import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { createGoogleDriveClient } from '@/lib/google-auth';
import { format, endOfWeek } from 'date-fns';
import { Readable } from 'stream';
import { JobsActivityLogger } from '@/lib/activity-logger';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    // Get job details for folder structure
    const job = await prisma.jobs.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const baseFolderId = formData.get('baseFolderId') as string;
    const driveId = formData.get('driveId') as string;
    
    // Get attachment types for each file
    const attachmentTypes: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const attachmentType = formData.get(`attachmentTypes[${i}]`) as string;
      if (!attachmentType || !['runsheet', 'docket', 'delivery_photos'].includes(attachmentType)) {
        return NextResponse.json({ error: `Invalid attachment type for file ${i + 1}` }, { status: 400 });
      }
      attachmentTypes.push(attachmentType);
    }

    if (!baseFolderId || !driveId) {
      return NextResponse.json({ error: 'Missing required folder or drive configuration' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Calculate week ending (upcoming Sunday from job date)
    const jobDate = new Date(job.date);
    const weekEnding = endOfWeek(jobDate, { weekStartsOn: 1 }); // Monday is start of week
    const weekEndingStr = format(weekEnding, 'dd.MM.yy');

    // Clean strings for folder/file names
    const cleanString = (str: string) => str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    
    const customerBillToFolder = `${cleanString(job.customer)}_-_${cleanString(job.billTo)}`;
    const jobDateStr = format(new Date(job.date), 'dd.MM');

    try {
      const drive = await createGoogleDriveClient();
      
      // Check if week ending folder exists, create if not
      const weekFolderResponse = await drive.files.list({
        q: `name='${weekEndingStr}' and parents in '${baseFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId: driveId
      });

      let weekFolderId: string;
      if (weekFolderResponse.data.files && weekFolderResponse.data.files.length > 0) {
        weekFolderId = weekFolderResponse.data.files[0].id!;
      } else {
        // Create week ending folder
        const weekFolderCreate = await drive.files.create({
          requestBody: {
            name: weekEndingStr,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [baseFolderId]
          },
          supportsAllDrives: true
        });
        weekFolderId = weekFolderCreate.data.id!;
      }

      // Check if customer-billTo folder exists under week ending, create if not
      const customerFolderResponse = await drive.files.list({
        q: `name='${customerBillToFolder}' and parents in '${weekFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId: driveId
      });

      let customerFolderId: string;
      if (customerFolderResponse.data.files && customerFolderResponse.data.files.length > 0) {
        customerFolderId = customerFolderResponse.data.files[0].id!;
      } else {
        // Create customer-billTo folder
        const customerFolderCreate = await drive.files.create({
          requestBody: {
            name: customerBillToFolder,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [weekFolderId]
          },
          supportsAllDrives: true
        });
        customerFolderId = customerFolderCreate.data.id!;
      }

      // Group uploaded files by attachment type
      const uploadedFilesByType: {
        runsheet: string[];
        docket: string[];
        delivery_photos: string[];
      } = {
        runsheet: [],
        docket: [],
        delivery_photos: []
      };
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachmentType = attachmentTypes[i];
        
        // Create organized filename: keep original name but add prefix for organization
        const originalFileName = file.name;
        const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
        const fileExtension = originalFileName.split('.').pop() || 'file';
        
        // Create prefix for organization: date_attachmenttype_originalname
        const organizationPrefix = `${jobDateStr}_${attachmentType}`;
        const baseFileName = `${organizationPrefix}_${cleanString(nameWithoutExt)}`;
        
        // Check for existing files with similar names
        const existingFilesResponse = await drive.files.list({
          q: `name contains '${organizationPrefix}_${cleanString(nameWithoutExt)}' and parents in '${customerFolderId}' and trashed=false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'drive',
          driveId: driveId
        });

        // Add number suffix if files exist
        let finalFileName = `${baseFileName}.${fileExtension}`;
        if (existingFilesResponse.data.files && existingFilesResponse.data.files.length > 0) {
          const existingCount = existingFilesResponse.data.files.length;
          finalFileName = `${baseFileName}_${existingCount + 1}.${fileExtension}`;
        }

        // Convert file to buffer
        const buffer = await file.arrayBuffer();
        
        // Create readable stream from buffer
        const stream = Readable.from(Buffer.from(buffer));
        
        // Upload to Google Drive
        const uploadResponse = await drive.files.create({
          requestBody: {
            name: finalFileName,
            parents: [customerFolderId]
          },
          media: {
            mimeType: file.type,
            body: stream
          },
          supportsAllDrives: true
        });

        if (uploadResponse.data.id) {
          // Generate sharing link
          await drive.permissions.create({
            fileId: uploadResponse.data.id,
            requestBody: {
              role: 'reader',
              type: 'anyone'
            },
            supportsAllDrives: true
          });

          const fileLink = `https://drive.google.com/file/d/${uploadResponse.data.id}/view?filename=${encodeURIComponent(finalFileName)}`;
          uploadedFilesByType[attachmentType as keyof typeof uploadedFilesByType].push(fileLink);
        }
      }

      // Update job record with new attachment URLs by type
      const updateData: {
        attachmentRunsheet?: { push: string[] };
        attachmentDocket?: { push: string[] };
        attachmentDeliveryPhotos?: { push: string[] };
      } = {};
      
      if (uploadedFilesByType.runsheet.length > 0) {
        updateData.attachmentRunsheet = {
          push: uploadedFilesByType.runsheet
        };
      }
      
      if (uploadedFilesByType.docket.length > 0) {
        updateData.attachmentDocket = {
          push: uploadedFilesByType.docket
        };
      }
      
      if (uploadedFilesByType.delivery_photos.length > 0) {
        updateData.attachmentDeliveryPhotos = {
          push: uploadedFilesByType.delivery_photos
        };
      }
      
      const updatedJob = await prisma.jobs.update({
        where: { id: jobId },
        data: updateData
      });

      // Log attachment upload activity
      const fileNames = files.map(file => file.name);
      const totalFiles = files.length;
      await JobsActivityLogger.logAttachmentUpload(
        jobId.toString(),
        job,
        {
          fileCount: totalFiles,
          attachmentTypes: [...new Set(attachmentTypes)], // Remove duplicates
          fileNames: fileNames
        },
        request
      );

      return NextResponse.json({
        success: true,
        uploadedFilesByType,
        job: updatedJob
      }, {
        headers: rateLimitResult.headers
      });

    } catch (driveError) {
      console.error('Google Drive error:', driveError);
      return NextResponse.json({
        error: 'Failed to upload files to Google Drive'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Attachment upload error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        attachmentRunsheet: true,
        attachmentDocket: true,
        attachmentDeliveryPhotos: true
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      attachments: {
        runsheet: job.attachmentRunsheet,
        docket: job.attachmentDocket,
        delivery_photos: job.attachmentDeliveryPhotos
      }
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Get attachments error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}