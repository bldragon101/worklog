-- CreateEnum
CREATE TYPE "CustomerInvoiceStatus" AS ENUM ('draft');

-- AlterTable
ALTER TABLE "Jobs" ADD COLUMN     "customerInvoiceId" INTEGER;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "separateInvoicesByReference" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "jobReference" TEXT,
    "reference" TEXT NOT NULL,
    "notes" TEXT,
    "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'draft',
    "waivedBreakDeductions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerInvoice_customerId_weekEnding_idx" ON "CustomerInvoice"("customerId", "weekEnding");

-- CreateIndex
CREATE INDEX "CustomerInvoice_weekEnding_idx" ON "CustomerInvoice"("weekEnding");

-- CreateIndex
CREATE INDEX "CustomerInvoice_status_idx" ON "CustomerInvoice"("status");

-- CreateIndex
CREATE INDEX "Jobs_customerInvoiceId_idx" ON "Jobs"("customerInvoiceId");

-- AddForeignKey
ALTER TABLE "Jobs" ADD CONSTRAINT "Jobs_customerInvoiceId_fkey" FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

