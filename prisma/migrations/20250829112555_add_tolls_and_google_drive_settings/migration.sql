-- AlterTable
ALTER TABLE "public"."Jobs" ADD COLUMN     "citylink" INTEGER,
ADD COLUMN     "eastlink" INTEGER,
ADD COLUMN     "jobReference" TEXT,
ALTER COLUMN "dropoff" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "imageUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GoogleDriveSettings" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "driveName" TEXT NOT NULL,
    "baseFolderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "folderPath" TEXT[],
    "purpose" TEXT NOT NULL DEFAULT 'job_attachments',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GoogleDriveSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "public"."User"("isActive");

-- CreateIndex
CREATE INDEX "GoogleDriveSettings_userId_purpose_isActive_idx" ON "public"."GoogleDriveSettings"("userId", "purpose", "isActive");

-- CreateIndex
CREATE INDEX "GoogleDriveSettings_isGlobal_purpose_isActive_idx" ON "public"."GoogleDriveSettings"("isGlobal", "purpose", "isActive");

-- CreateIndex
CREATE INDEX "Jobs_jobReference_idx" ON "public"."Jobs"("jobReference");

-- CreateIndex
CREATE INDEX "Jobs_eastlink_citylink_idx" ON "public"."Jobs"("eastlink", "citylink");
