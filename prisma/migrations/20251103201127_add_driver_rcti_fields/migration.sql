-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "address" TEXT,
ADD COLUMN     "abn" TEXT,
ADD COLUMN     "gstStatus" TEXT NOT NULL DEFAULT 'not_registered',
ADD COLUMN     "gstMode" TEXT NOT NULL DEFAULT 'exclusive',
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankBsb" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT;
