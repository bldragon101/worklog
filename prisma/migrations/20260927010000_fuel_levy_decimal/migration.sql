-- Allow fractional fuel levy percentages (e.g. 15.69%).
ALTER TABLE "Customer" ALTER COLUMN "fuelLevy" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "Driver" ALTER COLUMN "fuelLevy" SET DATA TYPE DOUBLE PRECISION;
