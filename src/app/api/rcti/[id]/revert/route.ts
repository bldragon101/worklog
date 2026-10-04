import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";
import {
  getRctiLineTotals,
  RCTI_TRANSACTION_OPTIONS,
  transitionRctiStatus,
} from "@/lib/rcti-status";
import { z } from "zod";
import { apiRoute, idParams } from "@/lib/api-route";

const revertSchema = z.object({
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

/**
 * POST /api/rcti/[id]/revert
 * Revert a paid RCTI to draft with a reason
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error reverting RCTI to draft",
  responseMessage: "Failed to revert RCTI to draft",
  handler: async ({ request, userId, params: { id: rctiId } }) => {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const validation = revertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 },
      );
    }

    const { reason } = validation.data;

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "paid") {
      return NextResponse.json(
        { error: "Only paid RCTIs can be reverted to draft" },
        { status: 400 },
      );
    }

    const now = new Date();

    // Reversing deductions, restoring totals from the lines, the status
    // change and its audit row are written together.
    const updatedRcti = await prisma.$transaction(async (tx) => {
      await removeDeductionsFromRcti({ rctiId, tx });
      const lineTotals = await getRctiLineTotals({ tx, rctiId });

      return transitionRctiStatus({
        tx,
        rctiId,
        fromStatus: "paid",
        toStatus: "draft",
        changedBy: userId,
        changedAt: now,
        reason,
        data: {
          ...lineTotals,
          paidAt: null,
          revertedToDraftAt: now,
          revertedToDraftReason: reason,
        },
      });
    }, RCTI_TRANSACTION_OPTIONS);

    return NextResponse.json(updatedRcti);
  },
});
