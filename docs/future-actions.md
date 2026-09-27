# Future Actions

Follow-ups from the stacked PRs #278–#283 (driver names, regional and country run features, golden seed, and the RCTI and E2E test coverage). Items marked **Tracked by a test** already have a test written as an expected failure (`it.fails`). When the item is fixed, that test starts failing; change `it.fails` to `it` so it becomes a normal test.

## 1. Money and security fixes (do first)

### 1.1 RCTI API routes only check sign-in
Any signed-in user, including the `viewer` role, can create, finalise, pay, batch pay and revert RCTIs, and manage deductions, by calling the API directly. The admin check in `src/middleware.ts` covers the `/rcti` page but not `/api/rcti/*`. Jobs report routes already reject non-admins.

- Routes: `src/app/api/rcti/**`, `src/app/api/rcti-deductions/**`, `src/app/api/rcti-settings/route.ts`. Only `rcti/[id]/lines/[lineId]` checks `checkPermission("manage_jobs_report")`.
- Fix: apply the same permission (or admin) check to every RCTI and deduction route.
- Tracked by a test: `tests/unit/app/api/rcti-lifecycle.test.ts` (RCTI payment permissions).

### 1.2 A job can be paid twice through "Add Jobs"
`POST /api/rcti/[id]/lines` with `jobIds` accepts any job id. It doesn't check that the job belongs to the RCTI's driver (by truck for subcontractors, by name otherwise), falls in the RCTI's week, or isn't already on another RCTI.

- File: `src/app/api/rcti/[id]/lines/route.ts`
- Tracked by a test: `tests/unit/app/api/rcti-add-jobs.test.ts`

### 1.3 No record of who finalised or paid an RCTI
Only "revert paid → draft" writes an `RctiStatusChange` row. Finalise, pay, batch pay and unfinalise record nothing. The golden seed fakes these rows, which hides the gap.

- Files: `src/app/api/rcti/[id]/finalize/route.ts`, `pay/route.ts`, `unfinalize/route.ts`, `src/app/api/rcti/pay-batch/route.ts`
- Tracked by a test: `tests/unit/app/api/rcti-lifecycle.test.ts` (finalise and pay audit rows)

### 1.4 Unfinalising or reverting reactivates cancelled deductions
`removeDeductionsFromRcti` sets every reversed deduction back to `active`, including ones that were cancelled after being applied. The cancelled amount is then deducted from the driver again.

- File: `src/lib/rcti-deductions.ts`
- Tracked by a test: `tests/unit/lib/rcti-deductions-remove.test.ts`

### 1.5 RCTI creation ignores the driver's GST settings when a request leaves them out
`rctiCreateSchema` defaults `gstStatus` to `not_registered` and `gstMode` to `exclusive`, so the route's fallback to the driver's own settings never runs. The RCTI page always sends them, so only other API callers are affected.

- File: `src/lib/validation.ts` (`rctiCreateSchema`)
- Tracked by a test: `tests/unit/app/api/rcti-create-refresh.test.ts`

### 1.6 Jobs on a finalised or paid RCTI can be edited or deleted
Nothing blocks or warns. The RCTI keeps its snapshot, so the jobs table and what was paid can silently drift apart. Decide whether to lock these jobs, warn before editing, or flag the RCTI.

### 1.7 Subcontractor jobs are matched by a single truck registration
RCTI creation and refresh match a subcontractor's jobs by `registration = driver.truck`. Jobs done in another truck, or after a truck change mid-week, are left off their RCTI.

### 1.8 Finalise isn't atomic
Deductions are applied in one transaction and the RCTI's status and total are updated afterwards in a separate call. If the second step fails, deductions are applied while the RCTI stays a draft. A unique constraint does prevent double deductions from a double-click.

### 1.9 Refresh can bring back a line deleted during the refresh
Refresh reads the RCTI's lines before its transaction, then deletes and recreates them. A line deleted while a refresh is running reappears. The E2E suite hit this timing when it didn't wait for refresh to finish.

## 2. Questions to decide

- **Credits on new manual lines:** new RCTI manual lines must have 0 or more hours, but existing lines can be edited to negative. The form accepts `-1` and then fails on save with "Invalid hours or rate". Should credits be entered directly?
- **Driver names on documents:** the jobs report PDF shows only the driver's first name. Should driver-facing documents show the full name?
- **Fuel levy base:** fuel levy is calculated on job lines before break deductions. Is that correct?
- **Lunch break threshold:** the break deduction applies when *charged* hours exceed 7, not the driver's paid hours. Is that correct?

## 3. Smaller UI issues

- Negative amounts show as `$-70.00` instead of `-$70.00` (RCTI lines).
- A Refresh button is shown on paid RCTIs, but the API only refreshes drafts.
- The jobs report PDF prints job hours without decimals (`22`) next to driver hours with them (`24.50`).
- The icon-only buttons and inputs now have ids and labels on the RCTI and jobs report pages. Other pages haven't been audited against the `AGENTS.md` id and label rules.

## 4. Test coverage still to add

- **Company settings default fuel levy:** changes a single shared settings row, so it needs a serial Playwright project, or a restore of the original value after the test.
- **Vehicles:** create, edit and delete.
- **Non-admin permissions:** needs a second, non-admin test user (`TEST_USER` is an admin). This would also cover item 1.1 end to end.
- **RCTI by-driver view:** covered by unit tests only.
- **RCTI and jobs report email:** needs Resend's test mode or a mocked sender so tests never send real email.
- **`quick-edit.spec.ts`:** depends on test order and specific golden jobs. Move it onto its own E2E data like the RCTI specs.

## 5. CI and tooling

- **Greptile:** the account has reached its 50-credit trial limit. #281–#283 weren't reviewed, and new pushes won't be until the plan is upgraded.
- **E2E queue:** the `e2e-dev-db` concurrency group keeps one running and one waiting E2E job. If a third queues, the older waiting one is cancelled and must be re-run. Pushing a whole stack at once causes this.
- **Local E2E runs:** these use the same dev database as CI and aren't part of the queue. Check `gh run list --workflow Tests --status in_progress` before running locally.
- **Migration drift:** `prisma/migrations/20260919000000_normalise_zero_driver_hours` was edited after it was applied. As a result, `prisma migrate dev` asks for a reset, and new migrations have to be applied with `prisma migrate deploy` until the file is restored or migrations are re-baselined.
