import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { rctiBatchPaySchema } from "@/lib/validation";
import { payFinalisedRctis, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { apiRoute } from "@/lib/api-route";

/**
 * POST /api/rcti/pay-batch
 * Mark multiple finalised RCTIs as paid in a single atomic operation.
 * Body: { ids: number[] }
 *
 * Only finalised RCTIs are marked as paid. Draft RCTIs and already-paid
 * RCTIs are reported back as skipped so the caller can surface the outcome.
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  errorMessage: "Error marking RCTIs as paid",
  responseMessage: "Failed to mark RCTIs as paid",
  handler: async ({ request, userId }) => {
    const body = await request.json().catch(() => null);
    const validation = rctiBatchPaySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400 },
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
      const paidIds = await prisma.$transaction(
        (tx) =>
          payFinalisedRctis({
            tx,
            rctiIds: eligibleIds,
            changedBy: userId,
          }),
        RCTI_TRANSACTION_OPTIONS,
      );
      paidCount = paidIds.length;
    }

    // `attemptedIds` are the RCTIs we tried to pay. Because the update is
    // guarded by status and concurrent requests may change rows in between,
    // `paidCount` (the rows the update returned) is the authoritative number
    // of RCTIs actually marked as paid by this request.
    return NextResponse.json({
      paidCount,
      attemptedIds: eligibleIds,
      skipped,
    });
  },
});
