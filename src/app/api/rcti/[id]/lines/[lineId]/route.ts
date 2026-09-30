import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { z } from "zod";
import { apiRoute, positiveIntParam } from "@/lib/api-route";
import { lockRcti, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { BREAK_DEDUCTION_CUSTOMER } from "@/lib/rcti-line-builder";
import { recalculateBreaksAndTotals } from "@/lib/rcti-break-recalculation";

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

      // A removed break deduction must not be rebuilt by the recalculation
      // below or by adding jobs later, so record its truck type as waived.
      if (line.customer === BREAK_DEDUCTION_CUSTOMER) {
        const { waivedBreakTruckTypes } = await tx.rcti.findUniqueOrThrow({
          where: { id: rctiId },
          select: { waivedBreakTruckTypes: true },
        });
        if (!waivedBreakTruckTypes.includes(line.truckType)) {
          await tx.rcti.update({
            where: { id: rctiId },
            data: {
              waivedBreakTruckTypes: [...waivedBreakTruckTypes, line.truckType],
            },
          });
        }
      }

      await recalculateBreaksAndTotals({ db: tx, rctiId });
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
