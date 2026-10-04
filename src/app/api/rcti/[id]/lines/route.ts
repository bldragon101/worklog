import { NextResponse } from "next/server";
import { z } from "zod";
import {
  manualRctiLineRequestSchema,
  RESERVED_MANUAL_LINE_CUSTOMER_MESSAGE,
} from "@/lib/utils/rcti-line-validation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { checkJobsForRcti, lockJobsForRcti } from "@/lib/rcti-job-eligibility";
import { lockRcti, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { requireRctiAccess } from "@/lib/rcti-access";
import {
  calculateLineAmounts,
  convertJobToRctiLine,
  calculateRctiTotals,
  getLineDriverHours,
} from "@/lib/utils/rcti-calculations";
import { apiRoute, idParams } from "@/lib/api-route";
import { recalculateBreaksAndTotals } from "@/lib/rcti-break-recalculation";

// POST /api/rcti/[id]/lines - Add manual line or import jobs
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error adding lines",
  responseMessage: "Failed to add lines",
  handler: async ({ request, params: { id: rctiId } }) => {
    const parsedBody = z
      .object({
        jobIds: z.unknown().optional(),
        manualLine: z.unknown().optional(),
      })
      .safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const body = parsedBody.data;

    // Check if RCTI exists and is draft
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true, driver: true },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add lines to draft RCTIs" },
        { status: 400 },
      );
    }

    // Two modes: manual entry or import from jobs
    if (body.jobIds && Array.isArray(body.jobIds)) {
      // Import jobs mode - validate and normalise jobIds first
      const validatedJobIds: number[] = [];

      for (const jobId of body.jobIds) {
        const numericId = Number(jobId);
        if (!Number.isInteger(numericId) || numericId <= 0) {
          return NextResponse.json(
            {
              error: `Invalid job ID: ${jobId}. Job IDs must be positive integers.`,
            },
            { status: 400 },
          );
        }
        validatedJobIds.push(numericId);
      }

      // Lock the RCTI and the jobs, then check and add them in one
      // transaction, so a job can never end up on two RCTIs.
      const outcome = await prisma.$transaction(async (tx) => {
        const lockedStatus = await lockRcti({ tx, rctiId });
        if (lockedStatus !== "draft") {
          return { error: "Can only add lines to draft RCTIs" };
        }

        await lockJobsForRcti({ tx, jobIds: validatedJobIds });
        const jobs = await tx.jobs.findMany({
          where: { id: { in: validatedJobIds } },
        });

        if (jobs.length === 0) {
          return { error: "No valid jobs found" };
        }

        const foundIds = new Set(jobs.map((job) => job.id));
        const missingIds = validatedJobIds.filter((id) => !foundIds.has(id));
        if (missingIds.length > 0) {
          return { error: `Jobs not found: ${missingIds.join(", ")}` };
        }

        const { rejected } = await checkJobsForRcti({
          tx,
          rctiId,
          weekEnding: rcti.weekEnding,
          driver: rcti.driver,
          jobs,
        });
        if (rejected.length > 0) {
          return {
            error: rejected.map((item) => item.reason).join(". "),
            rejected,
          };
        }

        const newLines = await tx.rctiLine.createManyAndReturn({
          data: jobs.map((job) => ({
            rctiId,
            ...convertJobToRctiLine({
              job,
              driver: rcti.driver,
              gstStatus: rcti.gstStatus as "registered" | "not_registered",
              gstMode: rcti.gstMode as "exclusive" | "inclusive",
            }),
          })),
        });

        // Recalculate breaks and RCTI totals (jobs may affect breaks)
        await recalculateBreaksAndTotals({ db: tx, rctiId });

        return { lines: newLines };
      }, RCTI_TRANSACTION_OPTIONS);

      if ("error" in outcome) {
        return NextResponse.json(
          { error: outcome.error, rejected: outcome.rejected },
          { status: 400 },
        );
      }
      const newLines = outcome.lines;

      return NextResponse.json(
        { message: "Jobs added successfully", lines: newLines },
        { status: 201 },
      );
    } else if (body.manualLine) {
      // Manual entry mode
      const validation = manualRctiLineRequestSchema.safeParse(body);
      if (!validation.success) {
        const invalidNumericField = validation.error.issues.some((issue) =>
          ["chargedHours", "travelTimeHours", "ratePerHour"].includes(
            String(issue.path[1]),
          ),
        );
        const reservedCustomer = validation.error.issues.some(
          (issue) => issue.message === RESERVED_MANUAL_LINE_CUSTOMER_MESSAGE,
        );
        return NextResponse.json(
          {
            error: reservedCustomer
              ? RESERVED_MANUAL_LINE_CUSTOMER_MESSAGE
              : invalidNumericField
                ? "Invalid hours or rate"
                : "Missing required fields for manual line entry",
          },
          { status: 400 },
        );
      }
      const {
        jobDate,
        customer,
        truckType,
        description,
        chargedHours: hours,
        travelTimeHours: travelHours,
        ratePerHour: rate,
      } = validation.data.manualLine;

      // Manual lines may be negative adjustments, so their hours stay signed.
      const totalDriverHours = getLineDriverHours({
        chargedHours: hours,
        travelTimeHours: travelHours,
        driverCharge: null,
      });
      const amounts = calculateLineAmounts({
        chargedHours: totalDriverHours,
        ratePerHour: rate,
        gstStatus: rcti.gstStatus as "registered" | "not_registered",
        gstMode: rcti.gstMode as "exclusive" | "inclusive",
      });

      // Lock the RCTI and add the line in one transaction, so a line cannot
      // land on an RCTI that is finalised while this request runs.
      const outcome = await prisma.$transaction(async (tx) => {
        const lockedStatus = await lockRcti({ tx, rctiId });
        if (lockedStatus !== "draft") {
          return { error: "Can only add lines to draft RCTIs" };
        }

        const line = await tx.rctiLine.create({
          data: {
            rctiId,
            jobId: null, // Manual entry - no associated job
            jobDate: new Date(jobDate),
            customer: customer.trim(),
            truckType: truckType.trim(),
            description: description?.trim() || null,
            chargedHours: hours,
            travelTimeHours: travelHours,
            driverCharge: null,
            ratePerHour: rate,
            amountExGst: amounts.amountExGst,
            gstAmount: amounts.gstAmount,
            amountIncGst: amounts.amountIncGst,
          },
        });

        // Recalculate RCTI totals (manual lines don't affect breaks)
        await recalculateRctiTotalsOnly({ db: tx, rctiId });

        return { line };
      }, RCTI_TRANSACTION_OPTIONS);

      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: 400 });
      }
      const newLine = outcome.line;

      return NextResponse.json(
        { message: "Manual line added successfully", line: newLine },
        { status: 201 },
      );
    } else {
      return NextResponse.json(
        { error: "Must provide either jobIds or manualLine" },
        { status: 400 },
      );
    }
  },
});

// Helper function to recalculate RCTI totals only (no break recalculation)
async function recalculateRctiTotalsOnly({
  db,
  rctiId,
}: {
  db: Prisma.TransactionClient;
  rctiId: number;
}) {
  const lines = await db.rctiLine.findMany({
    where: { rctiId },
  });

  const { subtotal, gst, total } = calculateRctiTotals(lines);

  await db.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}
