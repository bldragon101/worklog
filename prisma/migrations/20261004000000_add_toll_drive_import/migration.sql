-- AlterTable
ALTER TABLE "TollImport" ADD COLUMN     "driveFileId" TEXT;

-- CreateTable
CREATE TABLE "TollDriveCheck" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TollDriveCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TollImport_driveFileId_key" ON "TollImport"("driveFileId");

