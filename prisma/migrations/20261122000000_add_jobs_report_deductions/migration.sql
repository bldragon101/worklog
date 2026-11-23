-- AlterTable
ALTER TABLE "JobsReportLine" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "JobsReportDeduction" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobsReportDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobsReportDeduction_reportId_idx" ON "JobsReportDeduction"("reportId");

-- AddForeignKey
ALTER TABLE "JobsReportDeduction" ADD CONSTRAINT "JobsReportDeduction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "JobsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
