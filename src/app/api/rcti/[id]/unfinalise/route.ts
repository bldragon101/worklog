import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";
import {
  getRctiLineTotals,
  RCTI_TRANSACTION_OPTIONS,
  transitionRctiStatus,
} from "@/lib/rcti-status";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/rcti/[id]/unfinalise
 * Unfinalise an RCTI (revert to draft)
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error unfinalising RCTI",
  responseMessage: "Failed to unfinalise RCTI",
  handler: async ({ userId, params: { id: rctiId } }) => {
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status === "paid") {
      return NextResponse.json(
        { error: "Cannot unfinalise a paid RCTI" },
        { status: 400 },
      );
    }

    if (rcti.status === "draft") {
      return NextResponse.json(
        { error: "RCTI is already in draft status" },
        { status: 400 },
      );
    }

    // Reversing deductions, restoring totals from the lines, the status
    // change and its audit row are written together.
    const updatedRcti = await prisma.$transaction(async (tx) => {
      await removeDeductionsFromRcti({ rctiId, tx });
      const lineTotals = await getRctiLineTotals({ tx, rctiId });

      return transitionRctiStatus({
        tx,
        rctiId,
        fromStatus: "finalised",
        toStatus: "draft",
        changedBy: userId,
        data: lineTotals,
      });
    }, RCTI_TRANSACTION_OPTIONS);

    return NextResponse.json(updatedRcti);
  },
});
