-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "customer" TEXT NOT NULL,
    "billTo" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "tray" BOOLEAN NOT NULL DEFAULT false,
    "crane" BOOLEAN NOT NULL DEFAULT false,
    "semi" BOOLEAN NOT NULL DEFAULT false,
    "semiCrane" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
