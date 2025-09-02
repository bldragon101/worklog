import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { z } from 'zod';

// Validation schemas
const bulkDeleteSchema = z.object({
  jobIds: z.array(z.number()).min(1).max(100) // Limit to 100 jobs per batch
});

const bulkUpdateSchema = z.object({
  jobIds: z.array(z.number()).min(1).max(100),
  updates: z.object({
    invoiced: z.boolean().optional(),
    runsheet: z.boolean().optional(),
  }).refine(obj => Object.keys(obj).length > 0, {
    message: "At least one field must be provided for update"
  })
});

export async function DELETE(request: NextRequest) {
  try {
    // Apply security protection
    const protection = await withApiProtection(request);
    if (protection.error) {
      return protection.error;
    }

    // Parse and validate request body
    const body = await request.json();
    const { jobIds } = bulkDeleteSchema.parse(body);

    // Fetch jobs to delete for activity logging
    const jobsToDelete = await prisma.jobs.findMany({
      where: { 
        id: { in: jobIds }
      },
      select: {
        id: true,
        customer: true,
        date: true,
        driver: true
      }
    });

    if (jobsToDelete.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No jobs found'
      }, { status: 404 });
    }

    if (jobsToDelete.length !== jobIds.length) {
      return NextResponse.json({
        success: false,
        error: `Only ${jobsToDelete.length} of ${jobIds.length} jobs found`
      }, { status: 404 });
    }

    // Perform bulk delete in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.jobs.deleteMany({
        where: {
          id: { in: jobIds }
        }
      });

      return deleteResult;
    });

    // Log activity for each deleted job
    const activityPromises = jobsToDelete.map(job =>
      logActivity({
        action: 'DELETE',
        tableName: 'Jobs',
        recordId: job.id.toString(),
        oldData: job,
        description: `Bulk deleted job: ${job.customer} (${job.date})`,
        request
      })
    );

    // Don't block response on activity logging
    Promise.all(activityPromises).catch(error => {
      console.error('Failed to log bulk delete activities:', error);
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} jobs`
    }, {
      headers: protection.headers
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Bulk delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Apply security protection
    const protection = await withApiProtection(request);
    if (protection.error) {
      return protection.error;
    }

    // Parse and validate request body
    const body = await request.json();
    const { jobIds, updates } = bulkUpdateSchema.parse(body);

    // Fetch jobs for activity logging
    const jobsBefore = await prisma.jobs.findMany({
      where: { 
        id: { in: jobIds }
      }
    });

    if (jobsBefore.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No jobs found'
      }, { status: 404 });
    }

    if (jobsBefore.length !== jobIds.length) {
      return NextResponse.json({
        success: false,
        error: `Only ${jobsBefore.length} of ${jobIds.length} jobs found`
      }, { status: 404 });
    }

    // Perform bulk update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.jobs.updateMany({
        where: {
          id: { in: jobIds }
        },
        data: updates
      });

      return updateResult;
    });

    // Fetch updated jobs for activity logging
    const jobsAfter = await prisma.jobs.findMany({
      where: { id: { in: jobIds } }
    });

    // Log activity for each updated job
    const activityPromises = jobsBefore.map(jobBefore => {
      const jobAfter = jobsAfter.find(j => j.id === jobBefore.id);
      if (!jobAfter) return Promise.resolve();

      const changes = Object.keys(updates).join(', ');
      return logActivity({
        action: 'UPDATE',
        tableName: 'Jobs',
        recordId: jobBefore.id.toString(),
        oldData: jobBefore,
        newData: jobAfter,
        description: `Bulk updated job fields: ${changes}`,
        request
      });
    });

    // Don't block response on activity logging
    Promise.all(activityPromises).catch(error => {
      console.error('Failed to log bulk update activities:', error);
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `Successfully updated ${result.count} jobs`,
      updatedJobs: jobsAfter
    }, {
      headers: protection.headers
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    console.error('Bulk update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}