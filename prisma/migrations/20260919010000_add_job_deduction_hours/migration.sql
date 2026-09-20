-- Hours withheld from the driver for a job, kept separate from the
-- "driverCharge" driver hours total so a deduction can be entered on its own.
ALTER TABLE "Jobs" ADD COLUMN "deductionHours" DOUBLE PRECISION;
