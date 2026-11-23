-- Jobs reports now use the driver's deductions (shared with RCTIs) instead of
-- their own per-report deduction lines.

-- CreateTable
CREATE TABLE "JobsReportDeductionApplication" (
    "id" SERIAL NOT NULL,
    "deductionId" INTEGER NOT NULL,
    "reportId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "JobsReportDeductionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobsReportDeductionApplication_deductionId_idx" ON "JobsReportDeductionApplication"("deductionId");

-- CreateIndex
CREATE INDEX "JobsReportDeductionApplication_reportId_idx" ON "JobsReportDeductionApplication"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "JobsReportDeductionApplication_deductionId_reportId_key" ON "JobsReportDeductionApplication"("deductionId", "reportId");

-- AddForeignKey
ALTER TABLE "JobsReportDeductionApplication" ADD CONSTRAINT "JobsReportDeductionApplication_deductionId_fkey" FOREIGN KEY ("deductionId") REFERENCES "RctiDeduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobsReportDeductionApplication" ADD CONSTRAINT "JobsReportDeductionApplication_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "JobsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move existing per-report deduction lines into one-off driver deductions.
-- Lines on finalised reports are recorded as already applied to that report;
-- lines on drafts stay pending and apply when the report is finalised. The
-- source line id is held in "notes" only long enough to link applications.
INSERT INTO "RctiDeduction" (
    "driverId", "type", "description", "totalAmount", "amountPaid",
    "amountRemaining", "frequency", "amountPerCycle", "status", "startDate",
    "completedAt", "notes", "createdAt", "updatedAt"
)
SELECT
    r."driverId",
    d."type",
    d."description",
    d."amount",
    CASE WHEN r."status" = 'finalised' THEN d."amount" ELSE 0 END,
    CASE WHEN r."status" = 'finalised' THEN 0 ELSE d."amount" END,
    'once',
    NULL,
    (CASE WHEN r."status" = 'finalised' THEN 'completed' ELSE 'active' END)::"DeductionStatus",
    r."weekEnding",
    CASE WHEN r."status" = 'finalised' THEN CURRENT_TIMESTAMP ELSE NULL END,
    'migrated-jobs-report-deduction:' || d."id",
    d."createdAt",
    CURRENT_TIMESTAMP
FROM "JobsReportDeduction" d
JOIN "JobsReport" r ON r."id" = d."reportId";

INSERT INTO "JobsReportDeductionApplication" ("deductionId", "reportId", "amount", "appliedAt")
SELECT rd."id", d."reportId", d."amount", r."updatedAt"
FROM "JobsReportDeduction" d
JOIN "JobsReport" r ON r."id" = d."reportId"
JOIN "RctiDeduction" rd ON rd."notes" = 'migrated-jobs-report-deduction:' || d."id"
WHERE r."status" = 'finalised';

UPDATE "RctiDeduction" rd
SET "notes" = 'Moved from jobs report ' || r."reportNumber"
FROM "JobsReportDeduction" d
JOIN "JobsReport" r ON r."id" = d."reportId"
WHERE rd."notes" = 'migrated-jobs-report-deduction:' || d."id";

-- DropTable
DROP TABLE "JobsReportDeduction";
