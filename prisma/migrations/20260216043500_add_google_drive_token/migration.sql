-- CreateTable
CREATE TABLE "GoogleDriveToken" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "refreshTokenTag" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDriveToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleDriveToken_userId_isActive_idx" ON "GoogleDriveToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "GoogleDriveToken_isActive_idx" ON "GoogleDriveToken"("isActive");
