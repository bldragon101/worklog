-- CreateTable
CREATE TABLE "RctiSettings" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyAbn" TEXT,
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "companyLogo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RctiSettings_pkey" PRIMARY KEY ("id")
);
