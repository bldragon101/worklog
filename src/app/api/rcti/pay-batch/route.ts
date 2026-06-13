import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { rctiBatchPaySchema } from "@/lib/validation";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/pay-batch
 * Mark multiple finalised RCTIs as paid in a single atomic operation.
 * Body: { ids: number[] }
 *
 * Only finalised RCTIs are marked as paid. Draft RCTIs and already-paid
 * RCTIs are reported back as skipped so the caller can surface the outcome.
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json().catch(() => null);
    const validation = rctiBatchPaySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // De-duplicate requested ids
    const requestedIds = Array.from(new Set(validation.data.ids));

    const rctis = await prisma.rcti.findMany({
      where: { id: { in: requestedIds } },
      select: { id: true, status: true, invoiceNumber: true },
    });

    const foundIds = new Set(rctis.map((r) => r.id));

    const eligibleIds: number[] = [];
    const skipped: Array<{ id: number; reason: string }> = [];

    for (const id of requestedIds) {
      if (!foundIds.has(id)) {
        skipped.push({ id, reason: "RCTI not found" });
        continue;
      }
    }

    for (const rcti of rctis) {
      if (rcti.status === "finalised") {
        eligibleIds.push(rcti.id);
      } else if (rcti.status === "paid") {
        skipped.push({ id: rcti.id, reason: "Already marked as paid" });
      } else {
        skipped.push({
          id: rcti.id,
          reason: "Only finalised RCTIs can be marked as paid",
        });
      }
    }

    let paidCount = 0;
    if (eligibleIds.length > 0) {
      const paidAt = new Date();
      const result = await prisma.rcti.updateMany({
        where: { id: { in: eligibleIds }, status: "finalised" },
        data: { status: "paid", paidAt },
      });
      paidCount = result.count;
    }

    return NextResponse.json(
      {
        paidCount,
        paidIds: eligibleIds,
        skipped,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error marking RCTIs as paid:", error);
    return NextResponse.json(
      { error: "Failed to mark RCTIs as paid" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
