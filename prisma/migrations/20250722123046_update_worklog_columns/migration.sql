/*
  Warnings:

  - You are about to drop the column `client` on the `WorkLog` table. All the data in the column will be lost.
  - You are about to drop the column `finishTime` on the `WorkLog` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `WorkLog` table. All the data in the column will be lost.
  - You are about to drop the column `vehicle` on the `WorkLog` table. All the data in the column will be lost.
  - Added the required column `billTo` to the `WorkLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dropoff` to the `WorkLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pickup` to the `WorkLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registration` to the `WorkLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkLog" DROP COLUMN "client",
DROP COLUMN "finishTime",
DROP COLUMN "startTime",
DROP COLUMN "vehicle",
ADD COLUMN     "billTo" TEXT NOT NULL,
ADD COLUMN     "chargedHours" DOUBLE PRECISION,
ADD COLUMN     "driverCharge" DOUBLE PRECISION,
ADD COLUMN     "dropoff" TEXT NOT NULL,
ADD COLUMN     "invoiced" BOOLEAN,
ADD COLUMN     "pickup" TEXT NOT NULL,
ADD COLUMN     "registration" TEXT NOT NULL,
ADD COLUMN     "runsheet" BOOLEAN;
