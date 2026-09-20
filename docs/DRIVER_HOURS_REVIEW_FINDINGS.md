# Driver Hours Review Findings

Findings from the driver-hours and job-dialog review, with how each was resolved.

## High priority

### Driver-only jobs still create chargeable RCTI lines — resolved, no change to behaviour

**Decision: driver-only jobs stay on the RCTI in full.**

An RCTI is a payment document sent to the driver, not an invoice to the customer. A job the customer is not charged for is still worked, so excluding it - or zeroing its amount - would underpay the driver. The `driverOnly` flag only records that nothing is billed to the customer; customer invoicing is not calculated in this app.

The same applies to jobs reports, which are also sent to drivers.

What changed: the decision is documented on `buildRctiLinesFromJobs` and on `JobForLines.driverOnly` in `src/lib/rcti-line-builder.ts`, and on the `Jobs.driverOnly` column, so it is not "fixed" the other way later. Regression tests cover it:

- `tests/unit/driver-hours-line-semantics.test.ts` - a driver-only job produces a full-value line, pays identically to a chargeable job, still has deductions applied, and still counts towards break deductions.
- `tests/unit/app/api/rcti/refresh.test.ts` - a driver-only job survives a refresh.

### Clamping driver hours to zero breaks negative RCTI deduction lines — fixed

This was a live bug, not just a risk. Break-deduction lines are stored with negative `chargedHours`, and the travel-time migration copied `chargedHours` into `driverCharge`, so those lines also carry a negative stored total. The clamp turned them into zero-value lines on edit, on GST recalculation and on the PDF.

The root cause was one helper serving two different meanings of `driverCharge`:

- On `Jobs` it is an adjustment input (legacy override; negative meant "subtract").
- On `RctiLine` and `JobsReportLine` it is the **resolved total** captured when the line was built.

The paths are now separate:

- `getTotalDriverHours` / `getDriverHoursBreakdown` - jobs. Charged + travel, less any deduction, with the legacy override honoured. The zero floor now applies only when hours were actually adjusted, so an unadjusted negative value passes through.
- `getLineDriverHours` / `getLineDriverHoursBreakdown` - stored RCTI and jobs-report lines. The stored total is used as-is and keeps its sign.

Call sites updated: the RCTI line PATCH route (line edits and GST recalculation), manual line creation, the RCTI draft table, the RCTI PDF, the jobs-report page and the jobs-report PDF.

Regression tests: `tests/unit/driver-hours-line-semantics.test.ts`, `tests/unit/app/api/rcti/line-hours-edits.test.ts` (hours edit, rate edit, GST recalculation) and `tests/unit/rcti-pdf-negative-lines.test.tsx` (PDF rendering). Each was confirmed to fail with the clamp reinstated.

`tests/unit/app/api/rcti-patch-validation.test.ts` previously stubbed the whole calculations module with an outdated copy of the hours logic. It now stubs only the money helpers and runs the real hours helpers.

## Medium priority

### Deduction provenance is flattened when creating RCTI and jobs-report lines — resolved

Documented as intentional snapshot behaviour, with the edit path fixed.

A line stores charged hours, travel hours and the resolved driver total, so the deduction is always derivable as `chargedHours + travelTimeHours - driverCharge`. No extra column is needed, and the derivation stays correct if the source job later changes.

The real defect was in the edit path: editing a line's hours reset `driverCharge` to `chargedHours + travelTimeHours`, silently paying the withheld hours back to the driver. The PATCH route and the RCTI draft table now read the signed adjustment the line carries and re-apply it, so editing 8 charged hours to 10 on a line with a 1 hour deduction pays 10 rather than 11. Positive legacy additions are preserved in the same way.

Jobs-report lines cannot be edited at all - the report PATCH endpoint only accepts `notes` - so they are regenerated rather than mutated.

### Legacy `driverCharge` and `deductionHours` can stack — confirmed as intended

A deduction withholds hours from whatever the driver would otherwise be paid, so a base of 9 with a legacy total of 7 and a 1 hour deduction correctly pays 6. Applying the deduction to the base instead would ignore the legacy total and overpay.

This only affects jobs that already carry a legacy `driverCharge` **and** gain a new deduction; the job form no longer writes `driverCharge`. The ordering is documented on `getTotalDriverHours`, with coverage for legacy totals combined with zero, non-zero and over-sized deductions.

## Data migration

`20260919000000_normalise_zero_driver_hours` still needs confirming against production data. The migration file now carries the query to run first:

```sql
SELECT id, date, driver, "chargedHours", "travelTimeHours"
FROM "Jobs"
WHERE "driverCharge" = 0
  AND COALESCE("chargedHours", 0) + COALESCE("travelTimeHours", 0) > 0;

SELECT id, "chargedHours", "travelTimeHours", "driverCharge"
FROM "JobsReportLine"
WHERE "driverCharge" = 0
  AND COALESCE("chargedHours", 0) + COALESCE("travelTimeHours", 0) > 0;
```

An empty result from both queries makes the migration a no-op in practice. Any rows returned would switch from paying nothing to paying their charged plus travel hours, so they need checking first. The job form could never write a zero - the old schema required a positive value - so only a CSV import could have.

Three migrations remain unapplied: `20260919000000_normalise_zero_driver_hours`, `20260919010000_add_job_deduction_hours` and `20260919020000_add_job_driver_only`.

## Validation status

- TypeScript passed.
- ESLint passed (4 pre-existing warnings, unrelated).
- Full suite passed: 114 files, 2559 tests.
- Nothing committed.
