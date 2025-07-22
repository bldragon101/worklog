-- CreateTable
CREATE TABLE "WorkLog" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "driver" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "finishTime" TEXT NOT NULL,
    "truckType" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);
