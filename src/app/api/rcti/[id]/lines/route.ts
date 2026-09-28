import { NextRequest, NextResponse } from "next/server";
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
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  calculateLineAmounts,
  calculateLunchBreakLines,
  convertJobToRctiLine,
  calculateRctiTotals,
  getLineDriverHours,
} from "@/lib/utils/rcti-calculations";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// POST /api/rcti/[id]/lines - Add manual line or import jobs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireRctiAccess({
    headers: rateLimitResult.headers,
  });
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const rctiId = parseInt(id, 10);
    if (isNaN(rctiId)) {
      return NextResponse.json({ error: "Invalid RCTI ID" }, { status: 400 });
    }

    const parsedBody = z.object({
      jobIds: z.unknown().optional(),
      manualLine: z.unknown().optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: rateLimitResult.headers },
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
            { status: 400, headers: rateLimitResult.headers },
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
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      const newLines = outcome.lines;

      return NextResponse.json(
        { message: "Jobs added successfully", lines: newLines },
        { status: 201, headers: rateLimitResult.headers },
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
          { status: 400, headers: rateLimitResult.headers },
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

      const newLine = await prisma.rctiLine.create({
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
      await recalculateRctiTotalsOnly({ db: prisma, rctiId });

      return NextResponse.json(
        { message: "Manual line added successfully", line: newLine },
        { status: 201, headers: rateLimitResult.headers },
      );
    } else {
      return NextResponse.json(
        { error: "Must provide either jobIds or manualLine" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error adding lines:", error);
    return NextResponse.json({ error: "Failed to add lines" }, { status: 500 });
  }
}

// Helper function to recalculate breaks and RCTI totals
async function recalculateBreaksAndTotals({
  db,
  rctiId,
}: {
  db: Prisma.TransactionClient;
  rctiId: number;
}) {
  // Get RCTI with driver info
  const rcti = await db.rcti.findUnique({
    where: { id: rctiId },
    include: {
      driver: true,
      lines: true,
    },
  });

  if (!rcti) return;

  // Delete existing break lines (customer = "Break Deduction")
  await db.rctiLine.deleteMany({
    where: {
      rctiId,
      customer: "Break Deduction",
    },
  });

  // Get all remaining lines (job lines and manual lines)
  const allLines = await db.rctiLine.findMany({
    where: { rctiId },
  });

  // Calculate new break lines
  const breakLines = calculateLunchBreakLines({
    lines: allLines.map((line) => ({
      jobId: line.jobId,
      truckType: line.truckType,
      chargedHours: line.chargedHours,
      ratePerHour: line.ratePerHour,
    })),
    driverBreakHours: rcti.driver.breaks,
    gstStatus: rcti.gstStatus as "registered" | "not_registered",
    gstMode: rcti.gstMode as "exclusive" | "inclusive",
  });

  // Add new break lines
  if (breakLines.length > 0) {
    await Promise.all(
      breakLines.map((breakLine) =>
        db.rctiLine.create({
          data: {
            rctiId,
            jobId: null,
            jobDate: rcti.weekEnding,
            customer: "Break Deduction",
            truckType: breakLine.truckType,
            description: breakLine.description,
            chargedHours: -breakLine.totalBreakHours,
            travelTimeHours: 0,
            driverCharge: null,
            ratePerHour: breakLine.ratePerHour,
            amountExGst: breakLine.amountExGst,
            gstAmount: breakLine.gstAmount,
            amountIncGst: breakLine.amountIncGst,
          },
        }),
      ),
    );
  }

  // Recalculate totals from all lines including new breaks
  const finalLines = await db.rctiLine.findMany({
    where: { rctiId },
  });

  const { subtotal, gst, total } = calculateRctiTotals(finalLines);

  await db.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}

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
