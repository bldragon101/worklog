import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  RCTI_TRANSACTION_OPTIONS,
  RctiStatusConflictError,
  transitionRctiStatus,
} from "@/lib/rcti-status";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/[id]/pay
 * Mark an RCTI as paid
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
        { error: "RCTI is already marked as paid" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status === "draft") {
      return NextResponse.json(
        {
          error: "Cannot mark a draft RCTI as paid. Please finalise it first.",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const updatedRcti = await prisma.$transaction((tx) =>
      transitionRctiStatus({
        tx,
        rctiId,
        fromStatus: "finalised",
        toStatus: "paid",
        changedBy: authResult.userId,
        data: { paidAt: new Date() },
      }),
      RCTI_TRANSACTION_OPTIONS,
    );

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
    console.error("Error marking RCTI as paid:", error);
    return NextResponse.json(
      { error: "Failed to mark RCTI as paid" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
