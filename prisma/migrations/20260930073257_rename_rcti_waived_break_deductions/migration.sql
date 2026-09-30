-- Waivers are now keyed by truck type and rate ("Tray|80"), matching how
-- break deduction lines are grouped. Earlier values held only a truck type.
ALTER TABLE "Rcti" RENAME COLUMN "waivedBreakTruckTypes" TO "waivedBreakDeductions";

-- Convert each truck-type waiver into one key per rate its job lines use, so
-- existing waivers keep covering the same break lines.
UPDATE "Rcti" AS r
SET "waivedBreakDeductions" = COALESCE(
  (
    SELECT array_agg(DISTINCT l."truckType" || '|' || trim_scale(l."ratePerHour")::text)
    FROM "RctiLine" AS l
    WHERE l."rctiId" = r.id
      AND l."jobId" IS NOT NULL
      AND l."truckType" = ANY (r."waivedBreakDeductions")
  ),
  ARRAY[]::TEXT[]
)
WHERE cardinality(r."waivedBreakDeductions") > 0;
