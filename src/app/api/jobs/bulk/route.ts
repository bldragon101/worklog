import { NextRequest, NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";
import {
  batchCreateItemSchema,
  batchUpdateItemSchema,
  batchOperationSchema,
  parseIsoToUtcDate,
} from "@/lib/bulk-job-schemas";

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

export async function DELETE(request: NextRequest) {
  // Apply security protection
  const protection = await withApiProtection(request);
  if (protection.error) {
    return protection.error;
  }

  try {
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
        { status: 404, headers: protection.headers },
      );
    }

    if (jobsToDelete.length !== jobIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${jobsToDelete.length} of ${jobIds.length} jobs found`,
        },
        { status: 404, headers: protection.headers },
      );
    }

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

    return NextResponse.json(
      {
        success: true,
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} jobs`,
      },
      {
        headers: protection.headers,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400, headers: protection.headers },
      );
    }

    console.error("Bulk delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500, headers: protection.headers },
    );
  }
}

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
    chargedHours: item.chargedHours ?? null,
    driverCharge: item.driverCharge ?? null,
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
  if (data.chargedHours !== undefined)
    transformed.chargedHours = data.chargedHours ?? null;
  if (data.driverCharge !== undefined)
    transformed.driverCharge = data.driverCharge ?? null;
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

export async function POST(request: NextRequest) {
  const protection = await withApiProtection(request);
  if (protection.error) {
    return protection.error;
  }

  try {
    const body = await request.json();
    const { creates, updates, deletes } = batchOperationSchema.parse(body);

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

    return NextResponse.json(
      {
        success: true,
        createdCount: result.createdJobs.length,
        updatedCount: result.updatedJobs.length,
        deletedCount: result.deletedCount,
      },
      {
        headers: protection.headers,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400, headers: protection.headers },
      );
    }

    console.error("Batch operation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500, headers: protection.headers },
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Apply security protection
  const protection = await withApiProtection(request);
  if (protection.error) {
    return protection.error;
  }

  try {
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
        { status: 404, headers: protection.headers },
      );
    }

    if (jobsBefore.length !== jobIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${jobsBefore.length} of ${jobIds.length} jobs found`,
        },
        { status: 404, headers: protection.headers },
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

    return NextResponse.json(
      {
        success: true,
        updatedCount: result.count,
        message: `Successfully updated ${result.count} jobs`,
        updatedJobs: jobsAfter,
      },
      {
        headers: protection.headers,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400, headers: protection.headers },
      );
    }

    console.error("Bulk update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500, headers: protection.headers },
    );
  }
}
