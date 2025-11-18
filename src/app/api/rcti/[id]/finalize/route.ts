import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { toNumber } from "@/lib/utils/rcti-calculations";

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

    // Apply deductions before finalising
    const deductionResult = await applyDeductionsToRcti({
      rctiId,
      driverId: rcti.driverId,
      weekEnding: rcti.weekEnding,
      amountOverrides: overridesMap.size > 0 ? overridesMap : undefined,
    });

    // Recalculate total with deductions/reimbursements
    const netAdjustment =
      deductionResult.totalReimbursementAmount -
      deductionResult.totalDeductionAmount;
    const adjustedTotal = toNumber(rcti.total) + netAdjustment;

    const updatedRcti = await prisma.rcti.update({
      where: { id: rctiId },
      data: {
        status: "finalised",
        total: adjustedTotal,
      },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
        deductionApplications: {
          include: {
            deduction: {
              select: {
                id: true,
                type: true,
                description: true,
                frequency: true,
              },
            },
          },
        },
      },
    });

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
    console.error("Error finalising RCTI:", error);
    return NextResponse.json(
      { error: "Failed to finalise RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
