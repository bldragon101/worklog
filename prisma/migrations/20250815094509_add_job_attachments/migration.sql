-- AlterTable
ALTER TABLE "public"."Jobs" ADD COLUMN     "attachmentDeliveryPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "attachmentDocket" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "attachmentRunsheet" TEXT[] DEFAULT ARRAY[]::TEXT[];
