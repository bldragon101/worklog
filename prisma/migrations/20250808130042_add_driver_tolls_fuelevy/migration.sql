-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "fuelLevy" INTEGER,
ADD COLUMN     "tolls" BOOLEAN NOT NULL DEFAULT false;
