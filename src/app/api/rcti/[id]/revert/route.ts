import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";
import {
  getRctiLineTotals,
  RCTI_TRANSACTION_OPTIONS,
  RctiStatusConflictError,
  transitionRctiStatus,
} from "@/lib/rcti-status";
import { z } from "zod";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const revertSchema = z.object({
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

/**
 * POST /api/rcti/[id]/revert
 * Revert a paid RCTI to draft with a reason
 */
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
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const validation = revertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { reason } = validation.data;

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "paid") {
      return NextResponse.json(
        { error: "Only paid RCTIs can be reverted to draft" },
        { status: 400, headers: rateLimitResult.headers },
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
        changedBy: authResult.userId,
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

    return NextResponse.json(updatedRcti, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    if (error instanceof RctiStatusConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: rateLimitResult.headers },
      );
    }
    console.error("Error reverting RCTI to draft:", error);
    return NextResponse.json(
      { error: "Failed to revert RCTI to draft" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
