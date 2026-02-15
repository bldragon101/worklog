-- Rename RctiSettings table to CompanySettings
ALTER TABLE "RctiSettings" RENAME TO "CompanySettings";

-- Add emailReplyTo column to CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN "emailReplyTo" TEXT;

-- Add email column to Driver
ALTER TABLE "Driver" ADD COLUMN "email" TEXT;
