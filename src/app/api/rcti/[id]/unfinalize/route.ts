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

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/[id]/unfinalize
 * Unfinalise an RCTI (revert to draft)
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

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status === "paid") {
      return NextResponse.json(
        { error: "Cannot unfinalise a paid RCTI" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status === "draft") {
      return NextResponse.json(
        { error: "RCTI is already in draft status" },
        { status: 400, headers: rateLimitResult.headers },
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
        changedBy: authResult.userId,
        data: lineTotals,
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
    console.error("Error unfinalising RCTI:", error);
    return NextResponse.json(
      { error: "Failed to unfinalise RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
