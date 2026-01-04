-- AlterTable: Convert driver rate fields from INT to DECIMAL(10,2)
-- This allows decimal values like 35.5, 40.75 for driver rates

ALTER TABLE "Driver"
  ALTER COLUMN "tray" SET DATA TYPE DECIMAL(10,2) USING "tray"::numeric(10,2),
  ALTER COLUMN "crane" SET DATA TYPE DECIMAL(10,2) USING "crane"::numeric(10,2),
  ALTER COLUMN "semi" SET DATA TYPE DECIMAL(10,2) USING "semi"::numeric(10,2),
  ALTER COLUMN "semiCrane" SET DATA TYPE DECIMAL(10,2) USING "semiCrane"::numeric(10,2);

-- Clear cached query plans to prevent "cached plan must not change result type" errors
DISCARD PLANS;
