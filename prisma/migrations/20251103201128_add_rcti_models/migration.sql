-- CreateTable
CREATE TABLE "public"."Rcti" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverAddress" TEXT,
    "driverAbn" TEXT,
    "gstStatus" TEXT NOT NULL,
    "gstMode" TEXT NOT NULL,
    "bankAccountName" TEXT,
    "bankBsb" TEXT,
    "bankAccountNumber" TEXT,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rcti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RctiLine" (
    "id" SERIAL NOT NULL,
    "rctiId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "jobDate" TIMESTAMP(3) NOT NULL,
    "customer" TEXT NOT NULL,
    "truckType" TEXT NOT NULL,
    "description" TEXT,
    "chargedHours" DOUBLE PRECISION NOT NULL,
    "ratePerHour" DOUBLE PRECISION NOT NULL,
    "amountExGst" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "amountIncGst" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RctiLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rcti_invoiceNumber_key" ON "public"."Rcti"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Rcti_driverId_idx" ON "public"."Rcti"("driverId");

-- CreateIndex
CREATE INDEX "Rcti_weekEnding_idx" ON "public"."Rcti"("weekEnding");

-- CreateIndex
CREATE INDEX "Rcti_status_idx" ON "public"."Rcti"("status");

-- CreateIndex
CREATE INDEX "RctiLine_rctiId_idx" ON "public"."RctiLine"("rctiId");

-- CreateIndex
CREATE INDEX "RctiLine_jobId_idx" ON "public"."RctiLine"("jobId");

-- AddForeignKey
ALTER TABLE "public"."Rcti" ADD CONSTRAINT "Rcti_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RctiLine" ADD CONSTRAINT "RctiLine_rctiId_fkey" FOREIGN KEY ("rctiId") REFERENCES "public"."Rcti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
