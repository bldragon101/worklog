import type { Prisma } from "@/generated/prisma/client";
import type { JobsReportPdfData } from "@/components/jobs-report/jobs-report-pdf-template";

type JobsReportWithLinesAndDeductions = Prisma.JobsReportGetPayload<{
  include: {
    lines: true;
    deductionApplications: {
      include: { deduction: { select: { type: true; description: true } } };
    };
  };
}>;

/**
 * A deduction due on a draft report, previewed on its PDF.
 */
interface PendingDeductionPreview {
  id: number;
  type: string;
  description: string;
  amountToApply: number;
}

function toNullableNumber({
  value,
}: {
  value: Prisma.Decimal | null;
}): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * Converts a jobs report loaded from the database into the plain data the PDF
 * template renders. A finalised report lists the deductions applied to it
 * (skipped ones are left out); a draft previews `pendingDeductions`.
 */
export function toJobsReportPdfData({
  report,
  pendingDeductions = [],
}: {
  report: JobsReportWithLinesAndDeductions;
  pendingDeductions?: PendingDeductionPreview[];
}): JobsReportPdfData {
  const deductions =
    report.status === "draft"
      ? pendingDeductions.map((pending) => ({
          id: pending.id,
          type: pending.type,
          description: pending.description,
          amount: pending.amountToApply,
        }))
      : report.deductionApplications.map((application) => ({
          id: application.id,
          type: application.deduction.type,
          description: application.deduction.description,
          amount: application.amount.toNumber(),
        }));

  return {
    id: report.id,
    reportNumber: report.reportNumber,
    driverName: report.driverName,
    weekEnding: report.weekEnding.toISOString(),
    status: report.status,
    notes: report.notes,
    lines: report.lines.map((line) => ({
      id: line.id,
      jobDate: line.jobDate.toISOString(),
      customer: line.customer,
      truckType: line.truckType,
      description: line.description,
      startTime: line.startTime,
      finishTime: line.finishTime,
      chargedHours: toNullableNumber({ value: line.chargedHours }),
      travelTimeHours: toNullableNumber({ value: line.travelTimeHours }),
      driverCharge: toNullableNumber({ value: line.driverCharge }),
    })),
    deductions: deductions.filter((deduction) => deduction.amount > 0),
  };
}
