import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

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
      include: { lines: true },
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
          const hours = job.chargedHours || 0;
          const rate = job.driverCharge || 0;
          const amountExGst = hours * rate;
          const gstAmount =
            rcti.gstStatus === "registered" ? amountExGst * 0.1 : 0;
          const amountIncGst = amountExGst + gstAmount;

          return prisma.rctiLine.create({
            data: {
              rctiId,
              jobId: job.id,
              jobDate: new Date(job.date),
              customer: job.customer || "Unknown",
              truckType: job.truckType || "",
              description: job.comments || "",
              chargedHours: hours,
              ratePerHour: rate,
              amountExGst,
              gstAmount,
              amountIncGst,
            },
          });
        }),
      );

      // Recalculate RCTI totals
      await recalculateRctiTotals(rctiId);

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

      const amountExGst = hours * rate;
      const gstAmount = rcti.gstStatus === "registered" ? amountExGst * 0.1 : 0;
      const amountIncGst = amountExGst + gstAmount;

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
          amountExGst,
          gstAmount,
          amountIncGst,
        },
      });

      // Recalculate RCTI totals
      await recalculateRctiTotals(rctiId);

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

// Helper function to recalculate RCTI totals
async function recalculateRctiTotals(rctiId: number) {
  const lines = await prisma.rctiLine.findMany({
    where: { rctiId },
  });

  const subtotal = lines.reduce(
    (sum: number, line) => sum + line.amountExGst,
    0,
  );
  const gst = lines.reduce((sum: number, line) => sum + line.gstAmount, 0);
  const total = lines.reduce((sum: number, line) => sum + line.amountIncGst, 0);

  await prisma.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}
