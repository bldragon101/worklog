-- CreateTable
CREATE TABLE "TollTrip" (
    "id" SERIAL NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "tripStart" TIMESTAMP(3) NOT NULL,
    "tripEnd" TIMESTAMP(3),
    "tripDetails" TEXT NOT NULL,
    "lpn" TEXT,
    "tagNumber" TEXT,
    "registration" TEXT,
    "vehicleClass" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "importId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TollTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TollTag" (
    "tagNumber" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TollTag_pkey" PRIMARY KEY ("tagNumber")
);

-- CreateTable
CREATE TABLE "TollImport" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TollImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TollTrip_fingerprint_key" ON "TollTrip"("fingerprint");

-- CreateIndex
CREATE INDEX "TollTrip_tripStart_idx" ON "TollTrip"("tripStart");

-- CreateIndex
CREATE INDEX "TollTrip_registration_tripStart_idx" ON "TollTrip"("registration", "tripStart");

-- CreateIndex
CREATE INDEX "TollTrip_tagNumber_idx" ON "TollTrip"("tagNumber");

-- CreateIndex
CREATE INDEX "TollImport_createdAt_idx" ON "TollImport"("createdAt");

-- AddForeignKey
ALTER TABLE "TollTrip" ADD CONSTRAINT "TollTrip_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TollImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
