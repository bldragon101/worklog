-- Marks a job that is paid to the driver but not charged to the customer.
-- Existing jobs are all chargeable, so they default to false.
ALTER TABLE "Jobs" ADD COLUMN "driverOnly" BOOLEAN DEFAULT false;
