-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "tollCitylinkRate" DECIMAL(10,2) NOT NULL DEFAULT 31.00,
ADD COLUMN     "tollEastlinkRate" DECIMAL(10,2) NOT NULL DEFAULT 18.50;
