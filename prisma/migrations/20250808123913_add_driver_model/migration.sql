-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" SERIAL NOT NULL,
    "driver" TEXT NOT NULL,
    "truck" TEXT NOT NULL,
    "tray" INTEGER,
    "crane" INTEGER,
    "semi" INTEGER,
    "semiCrane" INTEGER,
    "breaks" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'Employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_driver_key" ON "public"."Driver"("driver");
