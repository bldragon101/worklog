import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { bankersRound } from "@/lib/utils/rcti-calculations";
import {
  getRctiLineTotals,
  RCTI_TRANSACTION_OPTIONS,
  RctiStatusConflictError,
  transitionRctiStatus,
} from "@/lib/rcti-status";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/[id]/finalize
 * Finalize an RCTI (lock it)
 * Body: { deductionOverrides?: { [deductionId: number]: number | null } }
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

    // Parse request body for deduction overrides
    const body = await request.json().catch(() => ({}));
    const deductionOverrides = body.deductionOverrides || {};

    // Convert overrides object to Map with validation and coercion
    const overridesMap = new Map<number, number | null>();
    for (const [key, value] of Object.entries(deductionOverrides)) {
      const deductionId = parseInt(key, 10);
      if (isNaN(deductionId)) {
        continue;
      }

      // Validate and coerce the override value
      if (value === null || value === undefined) {
        // Explicit null/undefined means skip this deduction
        overridesMap.set(deductionId, null);
      } else {
        // Reject non-number types before coercion (arrays, objects, booleans, empty strings)
        const valueType = typeof value;
        if (
          valueType === "boolean" ||
          valueType === "object" ||
          (valueType === "string" && (value as string).trim() === "")
        ) {
          return NextResponse.json(
            {
              error: `Invalid deduction override value for deduction ${deductionId}: must be a number or null`,
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        // Attempt numeric coercion
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          // Valid number - use it
          overridesMap.set(deductionId, numericValue);
        } else {
          // Invalid value (NaN, Infinity, etc.) - reject with 400
          return NextResponse.json(
            {
              error: `Invalid deduction override value for deduction ${deductionId}: must be a number or null`,
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }
      }
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCTIs can be finalised" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (rcti.lines.length === 0) {
      return NextResponse.json(
        { error: "Cannot finalise RCTI with no lines" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Deductions, the new total, the status change and its audit row are
    // written together, so a failure part way leaves the RCTI a draft with
    // no deductions applied.
    const { updatedRcti, deductionResult, netAdjustment } =
      await prisma.$transaction(async (tx) => {
        const deductionResult = await applyDeductionsToRcti({
          rctiId,
          driverId: rcti.driverId,
          weekEnding: rcti.weekEnding,
          amountOverrides: overridesMap.size > 0 ? overridesMap : undefined,
          tx,
        });

        const netAdjustment =
          deductionResult.totalReimbursementAmount -
          deductionResult.totalDeductionAmount;
        const lineTotals = await getRctiLineTotals({ tx, rctiId });

        const updatedRcti = await transitionRctiStatus({
          tx,
          rctiId,
          fromStatus: "draft",
          toStatus: "finalised",
          changedBy: authResult.userId,
          data: { total: bankersRound(lineTotals.total + netAdjustment) },
        });

        return { updatedRcti, deductionResult, netAdjustment };
      }, RCTI_TRANSACTION_OPTIONS);

    return NextResponse.json(
      {
        ...updatedRcti,
        deductionsSummary: {
          applied: deductionResult.applied,
          totalDeductions: deductionResult.totalDeductionAmount,
          totalReimbursements: deductionResult.totalReimbursementAmount,
          netAdjustment,
        },
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    if (error instanceof RctiStatusConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: rateLimitResult.headers },
      );
    }
    console.error("Error finalising RCTI:", error);
    return NextResponse.json(
      { error: "Failed to finalise RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
