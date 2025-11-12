import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  calculateLineAmounts,
  calculateLunchBreakLines,
  getDriverRateForTruckType,
} from "@/lib/utils/rcti-calculations";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// POST /api/rcti/[id]/lines - Add manual line or import jobs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const rctiId = parseInt(id, 10);
    if (isNaN(rctiId)) {
      return NextResponse.json({ error: "Invalid RCTI ID" }, { status: 400 });
    }

    const body = await request.json();

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
      // Import jobs mode
      const jobs = await prisma.jobs.findMany({
        where: {
          id: { in: body.jobIds },
        },
      });

      if (jobs.length === 0) {
        return NextResponse.json(
          { error: "No valid jobs found" },
          { status: 400 },
        );
      }

      // Create lines from jobs
      const newLines = await Promise.all(
        jobs.map(async (job) => {
          // Prioritise driverCharge for hours, fall back to chargedHours
          const hours =
            (job.driverCharge && job.driverCharge > 0
              ? job.driverCharge
              : job.chargedHours) || 0;

          // Always use job.truckType for display (Tray, Crane, Semi, etc.)
          const truckType = job.truckType;

          // Get rate from driver's truck type rates
          const rate =
            getDriverRateForTruckType({
              truckType: job.truckType,
              tray: rcti.driver.tray,
              crane: rcti.driver.crane,
              semi: rcti.driver.semi,
              semiCrane: rcti.driver.semiCrane,
            }) || 0;

          const amounts = calculateLineAmounts({
            chargedHours: hours,
            ratePerHour: rate,
            gstStatus: rcti.gstStatus as "registered" | "not_registered",
            gstMode: rcti.gstMode as "exclusive" | "inclusive",
          });

          // Format times for description (extract HH:mm without timezone conversion)
          const startTime = job.startTime
            ? `${String(new Date(job.startTime).getHours()).padStart(2, "0")}:${String(new Date(job.startTime).getMinutes()).padStart(2, "0")}`
            : "";
          const finishTime = job.finishTime
            ? `${String(new Date(job.finishTime).getHours()).padStart(2, "0")}:${String(new Date(job.finishTime).getMinutes()).padStart(2, "0")}`
            : "";

          // For subcontractors, include the actual driver name in the description
          let description = "";
          if (startTime && finishTime) {
            description =
              rcti.driver.type === "Subcontractor"
                ? `${job.driver} | ${startTime} - ${finishTime}`
                : `${startTime} - ${finishTime}`;
          } else {
            description = job.jobReference || job.comments || "";
            if (rcti.driver.type === "Subcontractor" && job.driver) {
              description = `${job.driver}${description ? " | " + description : ""}`;
            }
          }

          return prisma.rctiLine.create({
            data: {
              rctiId,
              jobId: job.id,
              jobDate: new Date(job.date),
              customer: job.customer || "Unknown",
              truckType: truckType || "",
              description,
              chargedHours: hours,
              ratePerHour: rate,
              amountExGst: amounts.amountExGst,
              gstAmount: amounts.gstAmount,
              amountIncGst: amounts.amountIncGst,
            },
          });
        }),
      );

      // Recalculate breaks and RCTI totals (jobs may affect breaks)
      await recalculateBreaksAndTotals(rctiId);

      return NextResponse.json(
        { message: "Jobs added successfully", lines: newLines },
        { status: 201, headers: rateLimitResult.headers },
      );
    } else if (body.manualLine) {
      // Manual entry mode
      const {
        jobDate,
        customer,
        truckType,
        description,
        chargedHours,
        ratePerHour,
      } = body.manualLine;

      // Validate required fields
      if (
        !jobDate ||
        !customer ||
        !truckType ||
        chargedHours === undefined ||
        ratePerHour === undefined
      ) {
        return NextResponse.json(
          { error: "Missing required fields for manual line entry" },
          { status: 400 },
        );
      }

      const hours = parseFloat(chargedHours);
      const rate = parseFloat(ratePerHour);

      if (isNaN(hours) || isNaN(rate) || hours < 0 || rate < 0) {
        return NextResponse.json(
          { error: "Invalid hours or rate" },
          { status: 400 },
        );
      }

      const amounts = calculateLineAmounts({
        chargedHours: hours,
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
          ratePerHour: rate,
          amountExGst: amounts.amountExGst,
          gstAmount: amounts.gstAmount,
          amountIncGst: amounts.amountIncGst,
        },
      });

      // Recalculate RCTI totals (manual lines don't affect breaks)
      await recalculateRctiTotalsOnly(rctiId);

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
async function recalculateBreaksAndTotals(rctiId: number) {
  // Get RCTI with driver info
  const rcti = await prisma.rcti.findUnique({
    where: { id: rctiId },
    include: {
      driver: true,
      lines: true,
    },
  });

  if (!rcti) return;

  // Delete existing break lines (customer = "Break Deduction")
  await prisma.rctiLine.deleteMany({
    where: {
      rctiId,
      customer: "Break Deduction",
    },
  });

  // Get all remaining lines (job lines and manual lines)
  const allLines = await prisma.rctiLine.findMany({
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
        prisma.rctiLine.create({
          data: {
            rctiId,
            jobId: null,
            jobDate: rcti.weekEnding,
            customer: "Break Deduction",
            truckType: breakLine.truckType,
            description: breakLine.description,
            chargedHours: -breakLine.totalBreakHours,
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
  const finalLines = await prisma.rctiLine.findMany({
    where: { rctiId },
  });

  const subtotal = finalLines.reduce(
    (sum: number, line) => sum + line.amountExGst,
    0,
  );
  const gst = finalLines.reduce((sum: number, line) => sum + line.gstAmount, 0);
  const total = finalLines.reduce(
    (sum: number, line) => sum + line.amountIncGst,
    0,
  );

  await prisma.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}

// Helper function to recalculate RCTI totals only (no break recalculation)
async function recalculateRctiTotalsOnly(rctiId: number) {
  const lines = await prisma.rctiLine.findMany({
    where: { rctiId },
  });

  const subtotal = lines.reduce(
    (sum: number, line) => sum + Number(line.amountExGst),
    0,
  );
  const gst = lines.reduce(
    (sum: number, line) => sum + Number(line.gstAmount),
    0,
  );
  const total = lines.reduce(
    (sum: number, line) => sum + Number(line.amountIncGst),
    0,
  );

  await prisma.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}
