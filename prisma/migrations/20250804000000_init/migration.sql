-- CreateTable
CREATE TABLE "Jobs" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "driver" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "truckType" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billTo" TEXT NOT NULL,
    "chargedHours" DOUBLE PRECISION,
    "driverCharge" DOUBLE PRECISION,
    "dropoff" TEXT NOT NULL,
    "invoiced" BOOLEAN,
    "pickup" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "runsheet" BOOLEAN,

    CONSTRAINT "Jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "customer" TEXT NOT NULL,
    "billTo" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "comments" TEXT,
    "fuelLevy" INTEGER,
    "tray" INTEGER,
    "crane" INTEGER,
    "semi" INTEGER,
    "semiCrane" INTEGER,
    "tolls" BOOLEAN NOT NULL DEFAULT false,
    "breakDeduction" DOUBLE PRECISION,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "registration" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yearOfManufacture" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "carryingCapacity" TEXT,
    "trayLength" TEXT,
    "craneReach" TEXT,
    "craneType" TEXT,
    "craneCapacity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registration_key" ON "Vehicle"("registration");

