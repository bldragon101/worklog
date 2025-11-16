import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  calculateLunchBreakLines,
  toNumber,
} from "@/lib/utils/rcti-calculations";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// DELETE /api/rcti/[id]/lines/[lineId] - Remove line from draft RCTI
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id, lineId: lineIdParam } = await params;
    const rctiId = parseInt(id, 10);
    const lineId = parseInt(lineIdParam, 10);

    if (isNaN(rctiId) || isNaN(lineId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID or Line ID" },
        { status: 400 },
      );
    }

    // Check if RCTI exists and is draft
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Can only remove lines from draft RCTIs" },
        { status: 400 },
      );
    }

    // Check if line exists and belongs to this RCTI
    const line = await prisma.rctiLine.findUnique({
      where: { id: lineId },
    });

    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    if (line.rctiId !== rctiId) {
      return NextResponse.json(
        { error: "Line does not belong to this RCTI" },
        { status: 400 },
      );
    }

    // Delete the line and recalculate in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.rctiLine.delete({
        where: { id: lineId },
      });

      // Recalculate breaks and RCTI totals
      await recalculateBreaksAndTotals(rctiId, tx);
    });

    return NextResponse.json(
      { message: "Line removed successfully" },
      { status: 200, headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error removing line:", error);
    return NextResponse.json(
      { error: "Failed to remove line" },
      { status: 500 },
    );
  }
}

// Helper function to recalculate breaks and RCTI totals
async function recalculateBreaksAndTotals(
  rctiId: number,
  tx: Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
  >,
) {
  // Get RCTI with driver info
  const rcti = await tx.rcti.findUnique({
    where: { id: rctiId },
    include: {
      driver: true,
      lines: true,
    },
  });

  if (!rcti) return;

  // Delete existing break lines (customer = "Break Deduction")
  await tx.rctiLine.deleteMany({
    where: {
      rctiId,
      customer: "Break Deduction",
    },
  });

  // Get all remaining lines (job lines and manual lines)
  const allLines = await tx.rctiLine.findMany({
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
        tx.rctiLine.create({
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
  const finalLines = await tx.rctiLine.findMany({
    where: { rctiId },
  });

  const subtotal = finalLines.reduce(
    (sum: number, line) => sum + toNumber(line.amountExGst),
    0,
  );
  const gst = finalLines.reduce(
    (sum: number, line) => sum + toNumber(line.gstAmount),
    0,
  );
  const total = finalLines.reduce(
    (sum: number, line) => sum + toNumber(line.amountIncGst),
    0,
  );

  await tx.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}
