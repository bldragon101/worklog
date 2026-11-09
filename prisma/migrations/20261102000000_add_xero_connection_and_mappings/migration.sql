-- CreateEnum
CREATE TYPE "XeroTruckClass" AS ENUM ('tray', 'crane', 'semi', 'semiCrane');

-- CreateTable
CREATE TABLE "XeroConnection" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "connectionId" TEXT,
    "userId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "refreshTokenTag" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "itemsSyncedAt" TIMESTAMP(3),
    "contactsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroItem" (
    "id" SERIAL NOT NULL,
    "itemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salesUnitPrice" DECIMAL(12,4),
    "salesAccountCode" TEXT,
    "salesTaxType" TEXT,
    "isSold" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroContact" (
    "id" SERIAL NOT NULL,
    "contactId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroVehicleItemMapping" (
    "id" SERIAL NOT NULL,
    "registration" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroVehicleItemMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroCompanyItemMapping" (
    "id" SERIAL NOT NULL,
    "companyKey" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "truckClass" "XeroTruckClass" NOT NULL,
    "itemCode" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroCompanyItemMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroContactMapping" (
    "id" SERIAL NOT NULL,
    "billToKey" TEXT NOT NULL,
    "billTo" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroContactMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroSettings" (
    "id" SERIAL NOT NULL,
    "salesAccountCode" TEXT NOT NULL DEFAULT '200',
    "taxType" TEXT NOT NULL DEFAULT 'OUTPUT',
    "breakItemCode" TEXT DEFAULT 'Break',
    "eastlinkItemCode" TEXT DEFAULT 'EL',
    "citylinkItemCode" TEXT DEFAULT 'CL',
    "fuelLevyItemCode" TEXT DEFAULT 'Fuel Levy',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XeroConnection_isActive_idx" ON "XeroConnection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "XeroItem_itemId_key" ON "XeroItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroItem_code_key" ON "XeroItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "XeroContact_contactId_key" ON "XeroContact"("contactId");

-- CreateIndex
CREATE INDEX "XeroContact_name_idx" ON "XeroContact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "XeroVehicleItemMapping_registration_key" ON "XeroVehicleItemMapping"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "XeroCompanyItemMapping_companyKey_truckClass_key" ON "XeroCompanyItemMapping"("companyKey", "truckClass");

-- CreateIndex
CREATE UNIQUE INDEX "XeroContactMapping_billToKey_key" ON "XeroContactMapping"("billToKey");

