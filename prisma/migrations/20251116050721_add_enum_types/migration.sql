-- CreateEnum: Define enum types for GST and status fields
CREATE TYPE "GstMode" AS ENUM ('exclusive', 'inclusive');
CREATE TYPE "GstStatus" AS ENUM ('not_registered', 'registered');
CREATE TYPE "RctiStatus" AS ENUM ('draft', 'finalised', 'paid');
CREATE TYPE "DeductionStatus" AS ENUM ('active', 'completed', 'cancelled');

-- AlterTable Driver: Convert gstMode and gstStatus to enums using safe migration
-- Step 1: Add temporary enum columns
ALTER TABLE "Driver" ADD COLUMN "gstMode_new" "GstMode";
ALTER TABLE "Driver" ADD COLUMN "gstStatus_new" "GstStatus";

-- Step 2: Copy data to new columns with type conversion
UPDATE "Driver" SET "gstMode_new" = "gstMode"::"GstMode";
UPDATE "Driver" SET "gstStatus_new" = "gstStatus"::"GstStatus";

-- Step 3: Set NOT NULL with defaults for new columns
ALTER TABLE "Driver" ALTER COLUMN "gstMode_new" SET NOT NULL;
ALTER TABLE "Driver" ALTER COLUMN "gstMode_new" SET DEFAULT 'exclusive'::"GstMode";
ALTER TABLE "Driver" ALTER COLUMN "gstStatus_new" SET NOT NULL;
ALTER TABLE "Driver" ALTER COLUMN "gstStatus_new" SET DEFAULT 'not_registered'::"GstStatus";

-- Step 4: Drop old columns and rename new ones
ALTER TABLE "Driver" DROP COLUMN "gstMode";
ALTER TABLE "Driver" DROP COLUMN "gstStatus";
ALTER TABLE "Driver" RENAME COLUMN "gstMode_new" TO "gstMode";
ALTER TABLE "Driver" RENAME COLUMN "gstStatus_new" TO "gstStatus";

-- AlterTable Rcti: Convert gstMode, gstStatus, and status to enums using safe migration
-- Step 1: Add temporary enum columns
ALTER TABLE "Rcti" ADD COLUMN "gstMode_new" "GstMode";
ALTER TABLE "Rcti" ADD COLUMN "gstStatus_new" "GstStatus";
ALTER TABLE "Rcti" ADD COLUMN "status_new" "RctiStatus";

-- Step 2: Copy data to new columns with type conversion
UPDATE "Rcti" SET "gstMode_new" = "gstMode"::"GstMode";
UPDATE "Rcti" SET "gstStatus_new" = "gstStatus"::"GstStatus";
UPDATE "Rcti" SET "status_new" = "status"::"RctiStatus";

-- Step 3: Set NOT NULL with defaults for new columns
ALTER TABLE "Rcti" ALTER COLUMN "gstMode_new" SET NOT NULL;
ALTER TABLE "Rcti" ALTER COLUMN "gstStatus_new" SET NOT NULL;
ALTER TABLE "Rcti" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "Rcti" ALTER COLUMN "status_new" SET DEFAULT 'draft'::"RctiStatus";

-- Step 4: Drop old columns and rename new ones
ALTER TABLE "Rcti" DROP COLUMN "gstMode";
ALTER TABLE "Rcti" DROP COLUMN "gstStatus";
ALTER TABLE "Rcti" DROP COLUMN "status";
ALTER TABLE "Rcti" RENAME COLUMN "gstMode_new" TO "gstMode";
ALTER TABLE "Rcti" RENAME COLUMN "gstStatus_new" TO "gstStatus";
ALTER TABLE "Rcti" RENAME COLUMN "status_new" TO "status";

-- AlterTable RctiDeduction: Convert status to enum using safe migration
-- Step 1: Add temporary enum column
ALTER TABLE "RctiDeduction" ADD COLUMN "status_new" "DeductionStatus";

-- Step 2: Copy data to new column with type conversion
UPDATE "RctiDeduction" SET "status_new" = "status"::"DeductionStatus";

-- Step 3: Set NOT NULL with default for new column
ALTER TABLE "RctiDeduction" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "RctiDeduction" ALTER COLUMN "status_new" SET DEFAULT 'active'::"DeductionStatus";

-- Step 4: Drop old column and rename new one
ALTER TABLE "RctiDeduction" DROP COLUMN "status";
ALTER TABLE "RctiDeduction" RENAME COLUMN "status_new" TO "status";
