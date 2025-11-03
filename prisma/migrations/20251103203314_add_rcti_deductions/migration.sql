-- CreateTable
CREATE TABLE "public"."RctiDeduction" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountRemaining" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "amountPerCycle" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RctiDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RctiDeductionApplication" (
    "id" SERIAL NOT NULL,
    "deductionId" INTEGER NOT NULL,
    "rctiId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "RctiDeductionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RctiDeduction_driverId_idx" ON "public"."RctiDeduction"("driverId");

-- CreateIndex
CREATE INDEX "RctiDeduction_status_idx" ON "public"."RctiDeduction"("status");

-- CreateIndex
CREATE INDEX "RctiDeduction_startDate_idx" ON "public"."RctiDeduction"("startDate");

-- CreateIndex
CREATE INDEX "RctiDeductionApplication_deductionId_idx" ON "public"."RctiDeductionApplication"("deductionId");

-- CreateIndex
CREATE INDEX "RctiDeductionApplication_rctiId_idx" ON "public"."RctiDeductionApplication"("rctiId");

-- AddForeignKey
ALTER TABLE "public"."RctiDeduction" ADD CONSTRAINT "RctiDeduction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RctiDeductionApplication" ADD CONSTRAINT "RctiDeductionApplication_deductionId_fkey" FOREIGN KEY ("deductionId") REFERENCES "public"."RctiDeduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RctiDeductionApplication" ADD CONSTRAINT "RctiDeductionApplication_rctiId_fkey" FOREIGN KEY ("rctiId") REFERENCES "public"."Rcti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
