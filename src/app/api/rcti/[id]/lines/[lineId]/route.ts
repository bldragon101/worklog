import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

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

    // Delete the line
    await prisma.rctiLine.delete({
      where: { id: lineId },
    });

    // Recalculate RCTI totals
    await recalculateRctiTotals(rctiId);

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

// Helper function to recalculate RCTI totals
async function recalculateRctiTotals(rctiId: number) {
  const lines = await prisma.rctiLine.findMany({
    where: { rctiId },
  });

  const subtotal = lines.reduce(
    (sum: number, line) => sum + line.amountExGst,
    0,
  );
  const gst = lines.reduce((sum: number, line) => sum + line.gstAmount, 0);
  const total = lines.reduce((sum: number, line) => sum + line.amountIncGst, 0);

  await prisma.rcti.update({
    where: { id: rctiId },
    data: {
      subtotal,
      gst,
      total,
    },
  });
}
