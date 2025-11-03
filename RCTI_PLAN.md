# RCTI feature plan

This document outlines a proposed design for building the Recipient Created Tax Invoice (RCTI) workflow to pay subcontractors and contractors for a week’s worth of jobs. It is aligned with current patterns in the codebase and Melbourne/Australia static time handling rules. Please review and comment before implementation.

## Goals

- Generate RCTIs by week ending (same cadence as Jobs page).
- Support drivers who are contractors and subcontractors.
- Use driver pay rates by truck type as defaults, with per-job override of hours and rates.
- Capture and store driver business details on RCTI page: address, ABN, GST status (registered or not; inclusive/exclusive), and bank account details.
- Allow locking/finalizing an RCTI; this is separate from Jobs.invoiced and does not modify it.
- Preserve a snapshot of job details/rates at invoice time for audit and compliance.
- Include the customer for each job line from the Jobs table (snapshotted on creation).

## Non-goals (phase 1)

- No integrations with accounting systems (e.g., Xero) yet.
- No PDF generation in phase 1 (can be added later).
- No changes to existing Jobs.invoiced behavior; RCTI finalization is independent and does not alter Jobs.invoiced.

## Data model

New Prisma models (snapshot-based design):

- Rcti
  - id: Int (pk)
  - driverId: Int (fk → Driver.id)
  - driverName: String (snapshot)
  - driverAddress: String?
  - driverAbn: String?
  - gstStatus: String // "registered" | "not_registered"
  - gstMode: String // "exclusive" | "inclusive" (applies only when registered=true)
  - bankAccountName: String?
  - bankBsb: String?
  - bankAccountNumber: String?
  - weekEnding: DateTime // stored as yyyy-MM-ddT00:00:00.000Z; treated as static local date
  - invoiceNumber: String @unique
  - subtotal: Float
  - gst: Float
  - total: Float
  - status: String // "draft" | "finalised" | "paid"
  - notes: String?
  - createdAt, updatedAt

- RctiLine
  - id: Int (pk)
  - rctiId: Int (fk → Rcti.id)
  - jobId: Int (fk → Jobs.id) // for traceability; do not depend on current Job values after snapshot
  - jobDate: DateTime
  - customer: String // copied from Jobs.customer at creation time
  - truckType: String
  - description: String? // pickup/dropoff or jobReference summary
  - chargedHours: Float // editable
  - ratePerHour: Float // editable
  - amountExGst: Float // calculated per line, stored
  - gstAmount: Float // stored for audit
  - amountIncGst: Float // stored for audit
  - createdAt, updatedAt

Driver model extensions:

- Address and compliance/banking fields added to Driver to seed RCTIs and for reuse:
  - address: String?
  - abn: String?
  - gstStatus: String // "registered" | "not_registered"
  - gstMode: String // "exclusive" | "inclusive"
  - bankAccountName: String?
  - bankBsb: String?
  - bankAccountNumber: String?

Notes:
- We will continue to use driver rate columns (tray, crane, semi, semiCrane) as defaults per truck type.
- Snapshot fields on Rcti/RctiLine ensure historical accuracy even if Job or Driver data change later.
- No enums in TypeScript; string literals in Prisma for simplicity and flexibility.

## Time and week-ending handling

- Follow the Jobs page convention: week starts Monday, ends Sunday.
- Do not adjust for timezones. Treat weekEnding as a static local date. For displaying HH:mm, use iso.substring(11, 16).
- When selecting week, reuse the PageControls pattern and compute the week range with the same logic as Jobs page (UI), while ensuring calculations on the server avoid local timezone conversions and use ISO date-only comparisons when possible.

## Calculations

- Line amount calculation:
  - amountExGst = chargedHours × ratePerHour
  - If gstStatus = "registered":
    - If gstMode = "exclusive": gstAmount = 10% of amountExGst; amountIncGst = amountExGst + gstAmount
    - If gstMode = "inclusive": amountIncGst = chargedHours × ratePerHour; gstAmount = amountIncGst − (amountIncGst / 1.1); amountExGst = amountIncGst − gstAmount
  - If gstStatus = "not_registered": gstAmount = 0; amountIncGst = amountExGst
- Rcti totals:
  - subtotal = sum of line.amountExGst
  - gst = sum of line.gstAmount
  - total = sum of line.amountIncGst
- Rounding: banker's rounding to 2 decimals at line level and at totals, consistent across UI and server.

## API routes (App Router)

All routes:
- Rate-limited via lib/rate-limit
- Auth via requireAuth
- Use singleton prisma

Endpoints:
- GET /api/rcti?driverId=&startDate=&endDate=&status=
  - List RCTIs with filters (week ending in date range).
- POST /api/rcti
  - Create a draft RCTI for a driver/week. Payload includes driverId, weekEnding, optional overrides for driver info (address, abn, gstStatus, gstMode, bank).
  - Server loads eligible Jobs within the week for that driver that are not already linked to any RCTI line, builds lines with defaults from driver rates by truck type, snapshots job fields, and returns created RCTI with lines.
- GET /api/rcti/:id
  - Get a single RCTI with lines.
- PATCH /api/rcti/:id
  - Update driver info, notes, status transitions (draft → finalised → paid), and line edits (chargedHours, ratePerHour).
  - Recalculate totals on the server.
- POST /api/rcti/:id/finalise
  - Validations then set status=finalised; does not modify Jobs.invoiced.
- POST /api/rcti/:id/unfinalise
  - Only if not paid; revert status to draft.
- POST /api/rcti/:id/pay
  - Set status=paid with paidAt (optional phase 1).

Notes:
- All inputs validated with Zod, with sanitized error messages.
- No database reset; use migrations.

## UI/UX (app/rcti)

Top-level page enhancements:
- Filters: driver selector, year/month/week ending (reuse PageControls behavior and styling).
- Summary cards can show totals and counts for the selected period.
- Driver details panel (editable in the RCTI form):
  - Address, ABN, GST registered toggle, GST mode toggle (inclusive/exclusive; disabled when not registered), bank fields.
  - These fields will seed from Driver when creating a draft RCTI but are editable within the RCTI (snapshot).
- Lines grid/table:
  - One row per job included in the week.
  - Columns: date, customer, truck type, description (pickup → dropoff or jobReference), charged hours (editable), rate per hour (editable), line totals (ex/incl/GST).
  - Per-row edit saves immediately or on Save All (configurable; default Save All to minimize unintended writes).
  - Row actions: open job in Jobs page; view attachments; remove line from RCTI (allowed only in draft).
- Totals footer and GST breakdown.
- Actions:
  - Create RCTI (from filters) button
  - Save (persist edits in draft)
  - Finalise RCTI (locks lines; does not affect Jobs.invoiced)
  - Mark as Paid (optional phase 1)
  - Delete Draft (only when draft and no jobs marked invoiced via this RCTI)
- Accessibility:
  - All icon buttons have title
  - All buttons have type attribute
  - onClick paired with keyboard events; hover paired with focus/blur
  - IDs for interactive elements in kebab-case

Editing behavior:
- When editing hours/rates, totals recalc live on client and again on server on save.
- When deleting a line in draft, the job remains eligible for future RCTIs (as long as it is not already attached to another RCTI).

## Workflow

- Create draft:
  - Select driver and week ending → Create RCTI
  - Server assembles jobs from Jobs table with date within Monday–Sunday of selected week and driver match; exclude jobs already attached to an RCTI.
  - Pre-fill lines from Jobs.chargedHours and driver rate for job.truckType; if Jobs.driverCharge exists, use as initial rate for that line.
- Review and edit:
  - Adjust per-line hours and rates as needed; optionally edit driver info.
- Save:
  - Persist edits and recalculate server-side.
- Finalise:
  - Lock the RCTI (status=finalised).
  - Lock included lines; no changes are made to Jobs.invoiced.
- Pay:
  - Optional phase 1; set status=paid for tracking.

## Integration with Jobs page

- RCTI finalization is independent and does not change Jobs.invoiced.
- The Jobs page “Mark as Invoiced” action is separate and does not affect RCTIs.
- When creating RCTIs, exclude jobs that are already included in another RCTI (regardless of Jobs.invoiced).

## Validation and edge cases

- Prevent creating multiple RCTIs for the same driver and week in draft/finalised if job overlap would occur.
- Handle drivers with no ABN or not GST registered:
  - If not registered, gstAmount is 0, totals are ex=inc.
- GST mode handling:
  - Inclusive rates will back-compute ex-GST correctly; exclusive rates add 10% GST.
- Week spanning months/year ends should include all days within Monday–Sunday regardless of month boundary (consistent with Jobs page).
- If a job is edited after draft creation but before finalization:
  - RCTI lines remain snapshots; users can manually adjust the line if needed.
- Rounding errors:
  - Consistent 2-decimal rounding on line and total computations both client and server.

## Security

- All RCTI API routes require auth (admin role as with current Financial section).
- Rate limiting via existing helper.
- No sensitive data in logs.
- Bank account info is stored and returned only to authorized users; consider masking on UI.

## Testing

- Unit tests:
  - GST computation for inclusive/exclusive and not registered cases.
  - Totals sum with rounding consistency.
  - Week filtering logic and eligible jobs selection.
- API tests:
  - Create draft with jobs included; no duplicates across drafts for same period.
  - Edit lines and recalc totals.
  - Finalise locks the RCTI only; Jobs.invoiced remains unchanged.
- Type checking and linting:
  - pnpm lint, pnpm test, pnpx tsc --noEmit

## Migration plan

- Add fields to Driver: address, abn, gstStatus, gstMode, bankAccountName, bankBsb, bankAccountNumber.
- Create Rcti and RctiLine models.
- Generate migration: pnpx prisma migrate dev --name add-rcti-models
- Generate client: pnpx prisma generate
- Backfill not required; existing drivers default to gstStatus="not_registered", gstMode="exclusive".

## Open questions

- Invoice numbering format and sequence ownership (global vs per-driver).
- Do we need to include tolls/allowances as separate lines or folded into rate? If separate, specify line types.
- PDF generation and export formats for phase 2.
- Should inclusive/exclusive be settable per RctiLine or only per Rcti (driver-level)? Proposed: per Rcti to keep compliance consistent; per-line discounts/surcharges can be modeled as line-specific rate overrides.

## Implementation slices (suggested order)

1) Prisma models and migrations (Driver fields, Rcti, RctiLine).  
2) API: create/list/get/patch/finalise; Zod schemas.  
3) UI: RCTI page scaffolding with filters and driver panel.  
4) Lines grid with inline edit and totals.  
5) Finalise flow with locking and edit prevention (no Jobs.invoiced updates).  
6) Tests and polish (a11y, error handling, loading states).

If this plan looks good, I’ll proceed by creating the Prisma migration, API routes, and UI scaffolding in small, reviewable PRs.
