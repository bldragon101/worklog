-- AlterTable: Convert monetary fields from DOUBLE PRECISION to DECIMAL(12,2)
-- This ensures exact precision for financial calculations

ALTER TABLE "Rcti"
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2) USING "subtotal"::numeric(12,2),
  ALTER COLUMN "gst" SET DATA TYPE DECIMAL(12,2) USING "gst"::numeric(12,2),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2) USING "total"::numeric(12,2);

ALTER TABLE "RctiLine"
  ALTER COLUMN "chargedHours" SET DATA TYPE DECIMAL(12,2) USING "chargedHours"::numeric(12,2),
  ALTER COLUMN "ratePerHour" SET DATA TYPE DECIMAL(12,2) USING "ratePerHour"::numeric(12,2),
  ALTER COLUMN "amountExGst" SET DATA TYPE DECIMAL(12,2) USING "amountExGst"::numeric(12,2),
  ALTER COLUMN "gstAmount" SET DATA TYPE DECIMAL(12,2) USING "gstAmount"::numeric(12,2),
  ALTER COLUMN "amountIncGst" SET DATA TYPE DECIMAL(12,2) USING "amountIncGst"::numeric(12,2);

ALTER TABLE "RctiDeduction"
  ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2) USING "totalAmount"::numeric(12,2),
  ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(12,2) USING "amountPaid"::numeric(12,2),
  ALTER COLUMN "amountRemaining" SET DATA TYPE DECIMAL(12,2) USING "amountRemaining"::numeric(12,2),
  ALTER COLUMN "amountPerCycle" SET DATA TYPE DECIMAL(12,2) USING "amountPerCycle"::numeric(12,2);

ALTER TABLE "RctiDeductionApplication"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2) USING "amount"::numeric(12,2);
