import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";
import { toNumber } from "@/lib/utils/rcti-calculations";

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

    const updatedRcti = await prisma.rcti.update({
      where: { id: rctiId },
      data: {
        status: "draft",
        subtotal,
        gst,
        total,
      },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(updatedRcti, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error unfinalising RCTI:", error);
    return NextResponse.json(
      { error: "Failed to unfinalise RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
