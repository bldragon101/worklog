import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { parseDeductionOverrides } from "@/lib/utils/deduction-overrides";
import { bankersRound } from "@/lib/utils/rcti-calculations";
import {
  getRctiLineTotals,
  lockRcti,
  RCTI_TRANSACTION_OPTIONS,
  RctiStatusConflictError,
  transitionRctiStatus,
} from "@/lib/rcti-status";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/rcti/[id]/finalise
 * Finalise an RCTI (lock it)
 * Body: { deductionOverrides?: { [deductionId: number]: number | null } }
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error finalising RCTI",
  responseMessage: "Failed to finalise RCTI",
  handler: async ({ request, userId, params: { id: rctiId } }) => {
    const body = await request.json().catch(() => ({}));
    const parsedOverrides = parseDeductionOverrides({ body });
    if ("error" in parsedOverrides) {
      return NextResponse.json(
        { error: parsedOverrides.error },
        { status: 400 },
      );
    }
    const overridesMap = parsedOverrides.overrides;

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCTIs can be finalised" },
        { status: 400 },
      );
    }

    if (rcti.lines.length === 0) {
      return NextResponse.json(
        { error: "Cannot finalise RCTI with no lines" },
        { status: 400 },
      );
    }

    // Deductions, the new total, the status change and its audit row are
    // written together, so a failure part way leaves the RCTI a draft with
    // no deductions applied.
    const { updatedRcti, deductionResult, netAdjustment } =
      await prisma.$transaction(async (tx) => {
        const lockedStatus = await lockRcti({ tx, rctiId });
        if (lockedStatus !== "draft") {
          throw new RctiStatusConflictError({ rctiId, fromStatus: "draft" });
        }

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
          changedBy: userId,
          data: { total: bankersRound(lineTotals.total + netAdjustment) },
        });

        return { updatedRcti, deductionResult, netAdjustment };
      }, RCTI_TRANSACTION_OPTIONS);

    return NextResponse.json({
      ...updatedRcti,
      deductionsSummary: {
        applied: deductionResult.applied,
        totalDeductions: deductionResult.totalDeductionAmount,
        totalReimbursements: deductionResult.totalReimbursementAmount,
        netAdjustment,
      },
    });
  },
});
