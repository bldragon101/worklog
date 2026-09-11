ALTER TABLE "Jobs" ADD COLUMN "travelTimeHours" DOUBLE PRECISION;
ALTER TABLE "RctiLine"
  ADD COLUMN "travelTimeHours" DECIMAL(12,2),
  ADD COLUMN "driverCharge" DECIMAL(12,2);
ALTER TABLE "JobsReportLine" ADD COLUMN "travelTimeHours" DECIMAL(12,2);

UPDATE "Jobs"
SET "travelTimeHours" = GREATEST(
  COALESCE("driverCharge", 0) - COALESCE("chargedHours", 0),
  0
);

UPDATE "JobsReportLine"
SET "travelTimeHours" = GREATEST(
  COALESCE("driverCharge", 0) - COALESCE("chargedHours", 0),
  0
);

UPDATE "RctiLine"
SET "driverCharge" = "chargedHours";

WITH linked_line_travel AS (
  SELECT
    rcti_line."id",
    LEAST(
      GREATEST(COALESCE(job."travelTimeHours", 0), 0),
      GREATEST(rcti_line."driverCharge"::DOUBLE PRECISION, 0)
    )::DECIMAL(12,2) AS "travelTimeHours"
  FROM "RctiLine" AS rcti_line
  INNER JOIN "Jobs" AS job ON rcti_line."jobId" = job."id"
)
UPDATE "RctiLine" AS rcti_line
SET
  "chargedHours" = rcti_line."driverCharge" - linked_line_travel."travelTimeHours",
  "travelTimeHours" = linked_line_travel."travelTimeHours"
FROM linked_line_travel
WHERE rcti_line."id" = linked_line_travel."id";

UPDATE "RctiLine"
SET "travelTimeHours" = 0
WHERE "travelTimeHours" IS NULL;
