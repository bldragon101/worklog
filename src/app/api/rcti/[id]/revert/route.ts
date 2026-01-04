import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";
import { toNumber } from "@/lib/utils/rcti-calculations";
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

  const authResult = await requireAuth();
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

    // Remove any applied deductions
    await removeDeductionsFromRcti({ rctiId });

    // Recalculate total back to original (without deductions)
    const lines = await prisma.rctiLine.findMany({
      where: { rctiId },
    });

    const subtotal = lines.reduce(
      (sum: number, line) => sum + toNumber(line.amountExGst),
      0,
    );
    const gst = lines.reduce(
      (sum: number, line) => sum + toNumber(line.gstAmount),
      0,
    );
    const total = lines.reduce(
      (sum: number, line) => sum + toNumber(line.amountIncGst),
      0,
    );

    const now = new Date();

    // Update RCTI and create status change record in a transaction
    const updatedRcti = await prisma.$transaction(async (tx) => {
      // Record the status change
      await tx.rctiStatusChange.create({
        data: {
          rctiId,
          fromStatus: "paid",
          toStatus: "draft",
          reason,
          changedBy: authResult.userId,
          changedAt: now,
        },
      });

      // Update RCTI
      return await tx.rcti.update({
        where: { id: rctiId },
        data: {
          status: "draft",
          subtotal,
          gst,
          total,
          paidAt: null,
          revertedToDraftAt: now,
          revertedToDraftReason: reason,
        },
        include: {
          driver: true,
          lines: {
            orderBy: { jobDate: "asc" },
          },
          statusChanges: {
            orderBy: { changedAt: "desc" },
          },
        },
      });
    });

    return NextResponse.json(updatedRcti, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error reverting RCTI to draft:", error);
    return NextResponse.json(
      { error: "Failed to revert RCTI to draft" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
