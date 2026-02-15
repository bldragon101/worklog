-- Sync schema drift: captures all changes applied to the database outside of migrations

-- Add isArchived column to Driver table
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Create index on Driver.isArchived
CREATE INDEX IF NOT EXISTS "Driver_isArchived_idx" ON "Driver"("isArchived");

-- Add revertedToDraftAt and revertedToDraftReason columns to Rcti table
ALTER TABLE "Rcti" ADD COLUMN IF NOT EXISTS "revertedToDraftAt" TIMESTAMP(3);
ALTER TABLE "Rcti" ADD COLUMN IF NOT EXISTS "revertedToDraftReason" TEXT;

-- Create index on Rcti.status
CREATE INDEX IF NOT EXISTS "Rcti_status_idx" ON "Rcti"("status");

-- Create index on RctiDeduction.status
CREATE INDEX IF NOT EXISTS "RctiDeduction_status_idx" ON "RctiDeduction"("status");

-- Create RctiStatusChange table
CREATE TABLE IF NOT EXISTS "RctiStatusChange" (
    "id" SERIAL NOT NULL,
    "rctiId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RctiStatusChange_pkey" PRIMARY KEY ("id")
);

-- Create indexes on RctiStatusChange
CREATE INDEX IF NOT EXISTS "RctiStatusChange_rctiId_idx" ON "RctiStatusChange"("rctiId");
CREATE INDEX IF NOT EXISTS "RctiStatusChange_changedAt_idx" ON "RctiStatusChange"("changedAt");

-- Add foreign key from RctiStatusChange to Rcti
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RctiStatusChange_rctiId_fkey'
        AND table_name = 'RctiStatusChange'
    ) THEN
        ALTER TABLE "RctiStatusChange" ADD CONSTRAINT "RctiStatusChange_rctiId_fkey"
            FOREIGN KEY ("rctiId") REFERENCES "Rcti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Rename CompanySettings primary key constraint if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RctiSettings_pkey'
        AND table_name = 'CompanySettings'
    ) THEN
        ALTER TABLE "CompanySettings" RENAME CONSTRAINT "RctiSettings_pkey" TO "CompanySettings_pkey";
    END IF;
END $$;
