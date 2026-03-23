-- CreateEnum
CREATE TYPE "JobsReportStatus" AS ENUM ('draft', 'finalised');

-- CreateTable
CREATE TABLE "JobsReport" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "status" "JobsReportStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobsReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobsReportLine" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "jobDate" TIMESTAMP(3) NOT NULL,
    "customer" TEXT NOT NULL,
    "truckType" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT,
    "finishTime" TEXT,
    "chargedHours" DECIMAL(12,2),
    "driverCharge" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobsReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobsReport_reportNumber_key" ON "JobsReport"("reportNumber");

-- CreateIndex
CREATE INDEX "JobsReport_driverId_idx" ON "JobsReport"("driverId");

-- CreateIndex
CREATE INDEX "JobsReport_weekEnding_idx" ON "JobsReport"("weekEnding");

-- CreateIndex
CREATE INDEX "JobsReport_status_idx" ON "JobsReport"("status");

-- CreateIndex
CREATE INDEX "JobsReportLine_reportId_idx" ON "JobsReportLine"("reportId");

-- CreateIndex
CREATE INDEX "JobsReportLine_jobId_idx" ON "JobsReportLine"("jobId");

-- AddForeignKey
ALTER TABLE "JobsReport" ADD CONSTRAINT "JobsReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobsReportLine" ADD CONSTRAINT "JobsReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "JobsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
