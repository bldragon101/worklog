import { NextResponse, after } from "next/server";
import { forbidWithoutPermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { syncJobAttachmentNames } from "@/lib/utils/attachment-utils";
import { getJobAttachmentConfig } from "@/lib/attachment-config";
import { z } from "zod";
import {
  getChangedLockedFields,
  getLockedJobMessage,
  getLockingRctis,
} from "@/lib/rcti-locked-jobs";
import {
  batchCreateItemSchema,
  batchUpdateItemSchema,
  batchOperationSchema,
  parseIsoToUtcDate,
} from "@/lib/bulk-job-schemas";
import { apiRoute } from "@/lib/api-route";

// Job fields that, when changed, require attached Google Drive files to be
// renamed (and potentially moved to a new folder) to stay in sync.
const ATTACHMENT_AFFECTING_FIELDS = [
  "date",
  "driver",
  "customer",
  "billTo",
  "truckType",
] as const;

type BulkUpdatedJob = {
  id: number;
  date: Date;
  driver: string | null;
  customer: string;
  billTo: string;
  truckType: string | null;
  attachmentRunsheet: string[];
  attachmentDocket: string[];
  attachmentDeliveryPhotos: string[];
};

/**
 * Builds a lookup of original URL -> renamed URL by diffing the pre-sync
 * snapshot against the post-sync array (both share the same indices), then
 * applies those substitutions to the current array. URLs added or removed by
 * concurrent requests are left untouched: additions are absent from the map so
 * pass through unchanged, and removals never reappear because they are not
 * present in `current`.
 */
function applyRenamedUrls({
  original,
  updated,
  current,
}: {
  original: string[];
  updated: string[];
  current: string[];
}): string[] {
  const renameMap = new Map<string, string>();
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== updated[i]) {
      renameMap.set(original[i], updated[i]);
    }
  }
  return current.map((url) => renameMap.get(url) ?? url);
}

/**
 * Renames (and moves) Google Drive attachments for jobs whose attachment-
 * affecting fields changed during a batch update. Mirrors the behaviour of the
 * single-job save flow, which calls /api/jobs/[id]/attachments/sync.
 *
 * Runs after the DB transaction has committed so Drive I/O never blocks the
 * transaction, and persists any updated attachment URLs back to the job.
 * Failures are logged but never fail the batch operation.
 */
async function syncBatchAttachmentNames({
  updatedJobs,
}: {
  updatedJobs: BulkUpdatedJob[];
}): Promise<void> {
  const jobsNeedingSync = updatedJobs.filter(
    (job) =>
      job.attachmentRunsheet.length > 0 ||
      job.attachmentDocket.length > 0 ||
      job.attachmentDeliveryPhotos.length > 0,
  );

  if (jobsNeedingSync.length === 0) {
    return;
  }

  const attachmentConfig = await getJobAttachmentConfig();

  await Promise.all(
    jobsNeedingSync.map(async (job) => {
      try {
        const syncResult = await syncJobAttachmentNames({
          job,
          baseFolderId: attachmentConfig?.baseFolderId,
          driveId: attachmentConfig?.driveId,
        });

        if (syncResult.renamed.length > 0) {
          // Re-read the latest attachment arrays and apply only the renamed
          // URL substitutions, so concurrent additions/removals made between
          // the batch snapshot and now are preserved rather than clobbered.
          await prisma.$transaction(async (tx) => {
            const latest = await tx.jobs.findUnique({
              where: { id: job.id },
              select: {
                attachmentRunsheet: true,
                attachmentDocket: true,
                attachmentDeliveryPhotos: true,
              },
            });
            if (!latest) return;

            await tx.jobs.update({
              where: { id: job.id },
              data: {
                attachmentRunsheet: applyRenamedUrls({
                  original: job.attachmentRunsheet,
                  updated: syncResult.updatedUrls.attachmentRunsheet,
                  current: latest.attachmentRunsheet,
                }),
                attachmentDocket: applyRenamedUrls({
                  original: job.attachmentDocket,
                  updated: syncResult.updatedUrls.attachmentDocket,
                  current: latest.attachmentDocket,
                }),
                attachmentDeliveryPhotos: applyRenamedUrls({
                  original: job.attachmentDeliveryPhotos,
                  updated: syncResult.updatedUrls.attachmentDeliveryPhotos,
                  current: latest.attachmentDeliveryPhotos,
                }),
              },
            });
          });
        }

        if (syncResult.errors.length > 0) {
          console.error(
            `Attachment sync completed with errors for job ${job.id}:`,
            syncResult.errors,
          );
        }
      } catch (error) {
        console.error(
          `Failed to sync attachment names for job ${job.id}:`,
          error,
        );
      }
    }),
  );
}

// Validation schemas
const bulkDeleteSchema = z.object({
  jobIds: z.array(z.number()).min(1).max(100), // Limit to 100 jobs per batch
});

const bulkUpdateSchema = z.object({
  jobIds: z.array(z.number()).min(1).max(100),
  updates: z
    .object({
      invoiced: z.boolean().optional(),
      runsheet: z.boolean().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

/**
 * 409 response listing jobs that are on a finalised or paid RCTI and would be
 * deleted (no `fields`) or have locked fields changed, or null when none are.
 */
async function getLockedJobsResponse({
  checks,
}: {
  checks: Array<{
    jobId: number;
    fields?: ReturnType<typeof getChangedLockedFields>;
  }>;
}) {
  const relevant = checks.filter(
    (check) => check.fields === undefined || check.fields.length > 0,
  );
  const locking = await getLockingRctis({
    db: prisma,
    jobIds: relevant.map((check) => check.jobId),
  });
  const messages = relevant.flatMap((check) => {
    const rcti = locking.get(check.jobId);
    return rcti
      ? [
          getLockedJobMessage({
            jobId: check.jobId,
            rcti,
            fields: check.fields,
          }),
        ]
      : [];
  });
  if (messages.length === 0) return null;

  return NextResponse.json(
    { success: false, error: messages.join(" ") },
    { status: 409 },
  );
}

export const DELETE = apiRoute({
  auth: { permission: "delete_jobs" },
  errorMessage: "Bulk delete error",
  validationMessage: "Invalid request data",
  errorBody: { success: false },
  handler: async ({ request }) => {
    // Parse and validate request body
    const body = await request.json();
    const { jobIds } = bulkDeleteSchema.parse(body);

    // Fetch jobs to delete for activity logging
    const jobsToDelete = await prisma.jobs.findMany({
      where: {
        id: { in: jobIds },
      },
      select: {
        id: true,
        customer: true,
        date: true,
        driver: true,
      },
    });

    if (jobsToDelete.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No jobs found",
        },
        { status: 404 },
      );
    }

    if (jobsToDelete.length !== jobIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${jobsToDelete.length} of ${jobIds.length} jobs found`,
        },
        { status: 404 },
      );
    }

    // Jobs on a finalised or paid RCTI cannot be deleted
    const lockedResponse = await getLockedJobsResponse({
      checks: jobIds.map((jobId) => ({ jobId })),
    });
    if (lockedResponse) return lockedResponse;

    // Perform bulk delete in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.jobs.deleteMany({
        where: {
          id: { in: jobIds },
        },
      });

      return deleteResult;
    });

    // Log activity for each deleted job
    const activityPromises = jobsToDelete.map((job) =>
      logActivity({
        action: "DELETE",
        tableName: "Jobs",
        recordId: job.id.toString(),
        oldData: job,
        description: `Bulk deleted job: ${job.customer} (${job.date})`,
        request,
      }),
    );

    // Don't block response on activity logging
    Promise.all(activityPromises).catch((error) => {
      console.error("Failed to log bulk delete activities:", error);
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} jobs`,
    });
  },
});

function transformCreateData({
  item,
}: {
  item: z.infer<typeof batchCreateItemSchema>;
}) {
  return {
    date: parseIsoToUtcDate({ isoString: item.date }),
    driver: item.driver.toUpperCase(),
    customer: item.customer,
    billTo: item.billTo,
    truckType: item.truckType,
    registration: item.registration.toUpperCase(),
    pickup: item.pickup,
    dropoff:
      typeof item.dropoff === "string" && item.dropoff.trim() !== ""
        ? item.dropoff.trim()
        : null,
    runsheet: item.runsheet ?? null,
    invoiced: item.invoiced ?? null,
    driverOnly: item.driverOnly ?? false,
    chargedHours: item.chargedHours ?? null,
    travelTimeHours: item.travelTimeHours ?? null,
    driverCharge: item.driverCharge ?? null,
    deductionHours: item.deductionHours ?? null,
    startTime: item.startTime
      ? parseIsoToUtcDate({ isoString: item.startTime })
      : null,
    finishTime: item.finishTime
      ? parseIsoToUtcDate({ isoString: item.finishTime })
      : null,
    comments:
      typeof item.comments === "string" && item.comments.trim() !== ""
        ? item.comments.trim()
        : null,
    jobReference:
      typeof item.jobReference === "string" && item.jobReference.trim() !== ""
        ? item.jobReference.trim()
        : null,
    eastlink: item.eastlink ?? null,
    citylink: item.citylink ?? null,
  };
}

function transformUpdateData({
  data,
}: {
  data: z.infer<typeof batchUpdateItemSchema>["data"];
}) {
  const transformed: Record<string, unknown> = {};

  if (data.date !== undefined)
    transformed.date = parseIsoToUtcDate({ isoString: data.date });
  if (data.driver !== undefined) transformed.driver = data.driver.toUpperCase();
  if (data.customer !== undefined) transformed.customer = data.customer;
  if (data.billTo !== undefined) transformed.billTo = data.billTo;
  if (data.truckType !== undefined) transformed.truckType = data.truckType;
  if (data.registration !== undefined)
    transformed.registration = data.registration.toUpperCase();
  if (data.pickup !== undefined) transformed.pickup = data.pickup;
  if (data.dropoff !== undefined)
    transformed.dropoff =
      typeof data.dropoff === "string" && data.dropoff.trim() !== ""
        ? data.dropoff.trim()
        : null;
  if (data.runsheet !== undefined) transformed.runsheet = data.runsheet ?? null;
  if (data.invoiced !== undefined) transformed.invoiced = data.invoiced ?? null;
  if (data.driverOnly !== undefined)
    transformed.driverOnly = data.driverOnly ?? false;
  if (data.chargedHours !== undefined)
    transformed.chargedHours = data.chargedHours ?? null;
  if (data.travelTimeHours !== undefined)
    transformed.travelTimeHours = data.travelTimeHours ?? null;
  if (data.driverCharge !== undefined) {
    transformed.driverCharge = data.driverCharge ?? null;
  }
  if (data.deductionHours !== undefined) {
    transformed.deductionHours = data.deductionHours ?? null;
  }
  if (data.startTime !== undefined)
    transformed.startTime = data.startTime
      ? parseIsoToUtcDate({ isoString: data.startTime })
      : null;
  if (data.finishTime !== undefined)
    transformed.finishTime = data.finishTime
      ? parseIsoToUtcDate({ isoString: data.finishTime })
      : null;
  if (data.comments !== undefined)
    transformed.comments =
      typeof data.comments === "string" && data.comments.trim() !== ""
        ? data.comments.trim()
        : null;
  if (data.jobReference !== undefined)
    transformed.jobReference =
      typeof data.jobReference === "string" && data.jobReference.trim() !== ""
        ? data.jobReference.trim()
        : null;
  if (data.eastlink !== undefined) transformed.eastlink = data.eastlink ?? null;
  if (data.citylink !== undefined) transformed.citylink = data.citylink ?? null;

  return transformed;
}

export const POST = apiRoute({
  auth: "user",
  errorMessage: "Batch operation error",
  validationMessage: "Invalid request data",
  errorBody: { success: false },
  handler: async ({ request }) => {
    const body = await request.json();
    const { creates, updates, deletes } = batchOperationSchema.parse(body);

    // A batch can mix creates, updates and deletes, so each kind present
    // needs its own permission
    const forbidden = await forbidWithoutPermissions({
      permissions: [
        ...(creates.length > 0 ? (["create_jobs"] as const) : []),
        ...(updates.length > 0 ? (["edit_jobs"] as const) : []),
        ...(deletes.length > 0 ? (["delete_jobs"] as const) : []),
      ],
    });
    if (forbidden) return forbidden;

    let existingJobs: Awaited<ReturnType<typeof prisma.jobs.findMany>> = [];
    if (updates.length > 0) {
      const updateIds = updates.map((item) => item.id);
      existingJobs = await prisma.jobs.findMany({
        where: { id: { in: updateIds } },
      });
      const existingIdSet = new Set(existingJobs.map((job) => job.id));
      const missingIds = updateIds.filter((id) => !existingIdSet.has(id));
      if (missingIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `${missingIds.length} job(s) not found`,
            missingIds,
          },
          { status: 404 },
        );
      }
    }

    // Jobs on a finalised or paid RCTI keep the values the driver was paid
    // on and cannot be deleted
    const existingById = new Map(existingJobs.map((job) => [job.id, job]));
    const lockedResponse = await getLockedJobsResponse({
      checks: [
        ...updates.map((item) => ({
          jobId: item.id,
          fields: getChangedLockedFields({
            existing: existingById.get(item.id) ?? {},
            update: transformUpdateData({ data: item.data }),
          }),
        })),
        ...deletes.map((jobId) => ({ jobId })),
      ],
    });
    if (lockedResponse) return lockedResponse;

    const result = await prisma.$transaction(async (tx) => {
      const createdJobs = await Promise.all(
        creates.map((item) => {
          const data = transformCreateData({ item });
          return tx.jobs.create({ data });
        }),
      );

      const updatedJobs = await Promise.all(
        updates.map((item) => {
          const data = transformUpdateData({ data: item.data });
          return tx.jobs.update({
            where: { id: item.id },
            data,
          });
        }),
      );

      let deletedCount = 0;
      if (deletes.length > 0) {
        const deleteResult = await tx.jobs.deleteMany({
          where: { id: { in: deletes } },
        });
        deletedCount = deleteResult.count;
      }

      return { createdJobs, updatedJobs, deletedCount };
    });

    // After the transaction commits, keep Google Drive attachment names in sync
    // for any updated job whose attachment-affecting fields changed. Only the
    // jobs whose update payload actually touched one of these fields are
    // considered, matching the single-job save behaviour.
    const jobsWithAttachmentFieldChanges = result.updatedJobs.filter(
      (_job, index) => {
        const changedData = updates[index]?.data ?? {};
        return ATTACHMENT_AFFECTING_FIELDS.some(
          (field) => changedData[field] !== undefined,
        );
      },
    ) as unknown as BulkUpdatedJob[];

    if (jobsWithAttachmentFieldChanges.length > 0) {
      // Defer Drive rename + DB writes until after the HTTP response is sent so
      // external I/O never blocks the batch response. The updatedJobs payload
      // returned below is unaffected.
      after(() =>
        syncBatchAttachmentNames({
          updatedJobs: jobsWithAttachmentFieldChanges,
        }),
      );
    }

    const activityPromises: Promise<void>[] = [];

    for (const job of result.createdJobs) {
      activityPromises.push(
        logActivity({
          action: "CREATE",
          tableName: "Jobs",
          recordId: job.id.toString(),
          newData: job as unknown as Record<string, unknown>,
          description: `Batch created job: ${job.customer} (${job.driver})`,
          request,
        }),
      );
    }

    for (const job of result.updatedJobs) {
      activityPromises.push(
        logActivity({
          action: "UPDATE",
          tableName: "Jobs",
          recordId: job.id.toString(),
          newData: job as unknown as Record<string, unknown>,
          description: `Batch updated job: ${job.customer} (${job.driver})`,
          request,
        }),
      );
    }

    for (const id of deletes) {
      activityPromises.push(
        logActivity({
          action: "DELETE",
          tableName: "Jobs",
          recordId: id.toString(),
          description: `Batch deleted job ID: ${id}`,
          request,
        }),
      );
    }

    Promise.all(activityPromises).catch((error) => {
      console.error("Failed to log batch operation activities:", error);
    });

    return NextResponse.json({
      success: true,
      createdCount: result.createdJobs.length,
      updatedCount: result.updatedJobs.length,
      deletedCount: result.deletedCount,
    });
  },
});

export const PATCH = apiRoute({
  auth: { permission: "edit_jobs" },
  errorMessage: "Bulk update error",
  validationMessage: "Invalid request data",
  errorBody: { success: false },
  handler: async ({ request }) => {
    // Parse and validate request body
    const body = await request.json();
    const { jobIds, updates } = bulkUpdateSchema.parse(body);

    // Fetch jobs for activity logging
    const jobsBefore = await prisma.jobs.findMany({
      where: {
        id: { in: jobIds },
      },
    });

    if (jobsBefore.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No jobs found",
        },
        { status: 404 },
      );
    }

    if (jobsBefore.length !== jobIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${jobsBefore.length} of ${jobIds.length} jobs found`,
        },
        { status: 404 },
      );
    }

    // Perform bulk update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.jobs.updateMany({
        where: {
          id: { in: jobIds },
        },
        data: updates,
      });

      return updateResult;
    });

    // Fetch updated jobs for activity logging
    const jobsAfter = await prisma.jobs.findMany({
      where: { id: { in: jobIds } },
    });

    // Log activity for each updated job
    const activityPromises = jobsBefore.map((jobBefore) => {
      const jobAfter = jobsAfter.find((j) => j.id === jobBefore.id);
      if (!jobAfter) return Promise.resolve();

      const changes = Object.keys(updates).join(", ");
      return logActivity({
        action: "UPDATE",
        tableName: "Jobs",
        recordId: jobBefore.id.toString(),
        oldData: jobBefore,
        newData: jobAfter,
        description: `Bulk updated job fields: ${changes}`,
        request,
      });
    });

    // Don't block response on activity logging
    Promise.all(activityPromises).catch((error) => {
      console.error("Failed to log bulk update activities:", error);
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `Successfully updated ${result.count} jobs`,
      updatedJobs: jobsAfter,
    });
  },
});
