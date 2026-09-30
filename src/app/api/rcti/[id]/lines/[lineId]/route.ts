import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { z } from "zod";
import { apiRoute, positiveIntParam } from "@/lib/api-route";
import { lockRcti, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import {
  calculateLunchBreakLines,
  toNumber,
} from "@/lib/utils/rcti-calculations";

const lineParams = z.object({
  id: positiveIntParam({ message: "Invalid RCTI ID or Line ID" }),
  lineId: positiveIntParam({ message: "Invalid RCTI ID or Line ID" }),
});

// DELETE /api/rcti/[id]/lines/[lineId] - Remove line from draft RCTI
export const DELETE = apiRoute({
  auth: requireRctiAccess,
  params: lineParams,
  errorMessage: "Error removing line",
  responseMessage: "Failed to remove line",
  handler: async ({ params: { id: rctiId, lineId } }) => {
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

    // Lock the RCTI so the delete cannot interleave with a refresh (which
    // would bring the line back) or a finalise, then delete and recalculate.
    const outcome = await prisma.$transaction(async (tx) => {
      const lockedStatus = await lockRcti({ tx, rctiId });
      if (lockedStatus !== "draft") {
        return { status: 400, error: "Can only remove lines from draft RCTIs" };
      }

      const deleted = await tx.rctiLine.deleteMany({
        where: { id: lineId, rctiId },
      });
      if (deleted.count === 0) {
        return {
          status: 404,
          error: "Line not found. The RCTI may have been refreshed.",
        };
      }

      // Recalculate breaks and RCTI totals
      await recalculateBreaksAndTotals(rctiId, tx);
      return null;
    }, RCTI_TRANSACTION_OPTIONS);

    if (outcome) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status },
      );
    }

    return NextResponse.json(
      { message: "Line removed successfully" },
      { status: 200 },
    );
  },
});

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
