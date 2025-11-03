# RCTI (Recipient Created Tax Invoice) Feature

## Overview

The RCTI feature allows you to generate and manage tax invoices for contractors and subcontractors based on their weekly jobs. This is a critical feature for Australian businesses that work with contractors, enabling proper GST handling and payment tracking.

## Key Features

- **Automated Invoice Generation** - Create RCTIs from weekly job data
- **GST Compliance** - Support for registered/unregistered GST status and inclusive/exclusive modes
- **Driver Business Details** - Capture ABN, address, and bank account information
- **Flexible Editing** - Adjust hours and rates before finalizing
- **Status Workflow** - Draft → Finalised → Paid progression
- **Job Snapshot** - Historical accuracy with snapshotted data
- **Week-based Organization** - Follows the same Monday-Sunday week pattern as Jobs

## How It Works

### 1. Create an RCTI

1. Navigate to the **RCTI** page
2. Select a **contractor or subcontractor** from the Driver dropdown
3. Select the **week ending date** using the navigation buttons
4. Click **Create RCTI**

The system will:
- Find all jobs for that driver in the selected week (Monday-Sunday)
- Exclude jobs already included in other RCTIs
- Pre-fill hours from job charged hours
- Pre-fill rates from driver rates (by truck type) or job driver charge
- Snapshot job details (customer, date, description)
- Calculate totals based on GST settings

### 2. Edit RCTI Details

While in **Draft** status, you can edit:

**Driver Information:**
- Address
- ABN (Australian Business Number)
- GST Status (Registered / Not Registered)
- GST Mode (Exclusive / Inclusive) - only when registered
- Bank Account Details (Name, BSB, Account Number)
- Notes

**Invoice Lines:**
- Charged Hours (editable)
- Rate Per Hour (editable)

All changes will automatically recalculate:
- Line amounts (ex GST, GST, inc GST)
- RCTI totals (subtotal, GST, total)

### 3. Finalise the RCTI

When ready:
1. Review all details and totals
2. Click **Finalise**
3. The RCTI is now locked - no further edits allowed

**Important:** Finalizing an RCTI does NOT affect the `Jobs.invoiced` field. These are separate workflows.

### 4. Mark as Paid

Once payment is made:
1. Click **Mark as Paid**
2. The RCTI status changes to **Paid**
3. A payment timestamp is recorded

### 5. Manage RCTIs

**Draft RCTIs:**
- Can be edited
- Can be deleted
- Can be finalised

**Finalised RCTIs:**
- Cannot be edited
- Cannot be deleted
- Can be unfinalised (reverted to draft)
- Can be marked as paid

**Paid RCTIs:**
- Cannot be edited
- Cannot be deleted
- Cannot be unfinalised

## GST Calculations

The system supports three GST modes:

### Not Registered
- **GST Amount:** $0
- **Ex GST = Inc GST**
- Use this for contractors not registered for GST

### Registered - Exclusive
- **Rate is ex-GST price**
- **GST = 10% of rate**
- **Inc GST = Ex GST + GST**
- Example: $50/hour → $5 GST → $55 inc GST

### Registered - Inclusive
- **Rate includes GST**
- **Ex GST = Rate ÷ 1.1**
- **GST = Inc GST - Ex GST**
- Example: $55/hour → $50 ex GST + $5 GST

All calculations use **banker's rounding** (round half to even) to 2 decimal places for financial accuracy.

## Invoice Numbering

Invoices are automatically numbered in the format:
```
RCTI-YYYYMMDD-NNNN
```

Examples:
- `RCTI-20250120-0001` - First RCTI on January 20, 2025
- `RCTI-20250120-0002` - Second RCTI on January 20, 2025

The sequence counter resets each day.

## Filtering and Viewing

**Filters Available:**
- Driver (select specific driver or "All Drivers")
- Week (navigate with previous/next or jump to today)
- Status (All / Draft / Finalised / Paid)

**Summary Cards:**
- Total RCTIs count for the selected period
- Count by status (Draft, Finalised, Paid)
- Total amount across all RCTIs

## Best Practices

### 1. Complete Driver Information First
Before creating RCTIs, ensure drivers have:
- Correct type (Contractor or Subcontractor, not Employee)
- Accurate pay rates (tray, crane, semi, semiCrane)
- Business details (address, ABN, bank account)

### 2. Review Before Finalizing
Once finalised, you cannot edit:
- Double-check all hours and rates
- Verify driver details are correct
- Confirm GST settings match the driver's registration
- Review totals

### 3. Keep Source Jobs Clean
- RCTI lines reference job IDs for traceability
- Changes to jobs after RCTI creation don't affect the RCTI (snapshot)
- Don't delete jobs that are included in finalised RCTIs

### 4. Use Notes Field
Add important information like:
- Payment reference numbers
- Special arrangements
- Deductions or adjustments
- Accounting notes

### 5. Weekly Workflow
Establish a regular routine:
1. Monday: Review previous week's jobs
2. Tuesday: Create draft RCTIs
3. Wednesday: Review and finalise
4. Thursday: Process payments
5. Friday: Mark as paid

## Troubleshooting

### "No eligible jobs found"
- Verify the driver has jobs in the selected week
- Check that jobs aren't already included in another RCTI
- Ensure jobs are in the date range (Monday-Sunday of selected week)

### "RCTIs can only be created for contractors and subcontractors"
- Check the driver's Type field in Drivers page
- Must be "Contractor" or "Subcontractor", not "Employee"

### "Cannot edit finalised RCTI"
- Finalised RCTIs are locked
- Click "Unfinalise" to revert to draft (if not paid)
- Make changes, then finalise again

### Totals Don't Match Expected
- System uses banker's rounding for accuracy
- GST mode affects calculation method
- Check if GST status is correct (registered vs not registered)

## Data Model

### Snapshot Behavior
RCTIs capture a **snapshot** of data at creation time:
- Driver name, address, ABN, bank details
- Job date, customer, truck type, description
- Initial hours and rates

This ensures:
- Historical accuracy if source data changes
- Audit compliance
- No surprises when reviewing old invoices

### Job Reuse Prevention
Once a job is included in an RCTI, it cannot be added to another RCTI, regardless of the RCTI's status. This prevents:
- Double-billing
- Confusion about which invoice covers which job
- Accounting errors

### Independence from Jobs.invoiced
- RCTI finalization does NOT set `Jobs.invoiced = true`
- These are separate workflows
- Jobs page "Mark as Invoiced" is for customer billing
- RCTI is for contractor/subcontractor payment

## API Reference

For developers and integrations:

### Endpoints

**List RCTIs**
```
GET /api/rcti?driverId={id}&startDate={iso}&endDate={iso}&status={status}
```

**Create RCTI**
```
POST /api/rcti
Body: { driverId, weekEnding, driverAddress?, driverAbn?, ... }
```

**Get Single RCTI**
```
GET /api/rcti/{id}
```

**Update RCTI**
```
PATCH /api/rcti/{id}
Body: { driverAddress?, notes?, lines?, ... }
```

**Delete RCTI (draft only)**
```
DELETE /api/rcti/{id}
```

**Finalise RCTI**
```
POST /api/rcti/{id}/finalise
```

**Unfinalise RCTI**
```
POST /api/rcti/{id}/unfinalise
```

**Mark as Paid**
```
POST /api/rcti/{id}/pay
```

All endpoints require authentication and admin role.

## Security

- **Authentication Required** - All endpoints require valid Clerk session
- **Admin Only** - RCTI access restricted to admin role
- **Rate Limited** - 150 requests per 15 minutes
- **Input Validation** - Zod schemas validate all inputs
- **Sanitized Errors** - No sensitive data in error messages

## Future Enhancements

Planned features for future releases:
- PDF generation and download
- Email RCTI to driver
- Xero/accounting system integration
- Bulk RCTI creation (multiple drivers)
- RCTI templates
- Payment tracking with reference numbers
- Separate line items for tolls/allowances
- Historical reporting and analytics

## Support

For issues or questions:
1. Check this documentation
2. Review RCTI_IMPLEMENTATION.md for technical details
3. Check browser console for errors
4. Verify database has Rcti and RctiLine tables
5. Ensure Prisma client is generated

## Related Documentation

- [RCTI_PLAN.md](../RCTI_PLAN.md) - Original feature specification
- [RCTI_IMPLEMENTATION.md](../RCTI_IMPLEMENTATION.md) - Technical implementation details
- [AGENTS.md](../AGENTS.md) - Development guidelines