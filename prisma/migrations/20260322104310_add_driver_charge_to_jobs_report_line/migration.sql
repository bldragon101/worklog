-- AlterTable
ALTER TABLE "JobsReportLine" ADD COLUMN IF NOT EXISTS "driverCharge" DECIMAL(12,2);

-- DropColumn
ALTER TABLE "JobsReportLine" DROP COLUMN IF EXISTS "description";
