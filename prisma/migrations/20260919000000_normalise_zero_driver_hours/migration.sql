-- Driver hours (stored as "driverCharge") now treat 0 as an explicit
-- "pay nothing" total rather than "no override". Clear legacy zero values so
-- they keep falling back to charged hours plus travel hours.
UPDATE "Jobs" SET "driverCharge" = NULL WHERE "driverCharge" = 0;
UPDATE "JobsReportLine" SET "driverCharge" = NULL WHERE "driverCharge" = 0;
