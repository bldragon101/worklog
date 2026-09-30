import type { Prisma } from "@/generated/prisma/client";
import {
  BREAK_DEDUCTION_CUSTOMER,
  buildBreakDeductionLines,
} from "@/lib/rcti-line-builder";
import { calculateRctiTotals } from "@/lib/utils/rcti-calculations";

/**
 * Rebuild a draft RCTI's lunch-break deduction lines from its current job
 * lines, then recalculate its totals. Truck types whose break deduction was
 * removed from the RCTI are skipped.
 */
export async function recalculateBreaksAndTotals({
  db,
  rctiId,
}: {
  db: Prisma.TransactionClient;
  rctiId: number;
}) {
  const rcti = await db.rcti.findUnique({
    where: { id: rctiId },
    include: { driver: true },
  });

  if (!rcti) return;

  await db.rctiLine.deleteMany({
    where: { rctiId, customer: BREAK_DEDUCTION_CUSTOMER },
  });

  const remainingLines = await db.rctiLine.findMany({ where: { rctiId } });

  const breakLines = buildBreakDeductionLines({
    lines: remainingLines,
    driverBreakHours: rcti.driver.breaks,
    weekEndingDate: rcti.weekEnding,
    gstStatus: rcti.gstStatus,
    gstMode: rcti.gstMode,
    waivedBreakTruckTypes: rcti.waivedBreakTruckTypes,
  });

  if (breakLines.length > 0) {
    await db.rctiLine.createMany({
      data: breakLines.map((line) => ({ ...line, rctiId })),
    });
  }

  const finalLines = await db.rctiLine.findMany({ where: { rctiId } });
  const { subtotal, gst, total } = calculateRctiTotals(finalLines);

  await db.rcti.update({
    where: { id: rctiId },
    data: { subtotal, gst, total },
  });
}
