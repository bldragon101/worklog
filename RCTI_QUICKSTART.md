# RCTI Quick Start Guide

## ✅ Pre-Flight Checklist

Before using the RCTI feature, ensure:

1. **Prisma client is generated**
   ```bash
   pnpx prisma generate
   ```

2. **Database is updated**
   ```bash
   pnpx prisma db push
   ```

3. **Development server is running**
   ```bash
   pnpm dev
   ```

4. **You have admin access** - RCTI section requires admin role

## 🚀 Getting Started (5 Minutes)

### Step 1: Set Up a Contractor Driver

1. Navigate to **Drivers** page
2. Create or edit a driver with:
   - **Type**: "Contractor" or "Subcontractor" (NOT "Employee")
   - **Pay Rates**: Fill in rates for truck types (e.g., Tray: 50, Crane: 60)
   - **Business Details** (optional but recommended):
     - Address
     - ABN
     - GST Status
     - Bank Account Details

### Step 2: Create Jobs for the Week

1. Navigate to **Jobs** page
2. Create some jobs for your contractor driver
3. Ensure jobs have:
   - Date within the current week
   - Driver name matching your contractor
   - Truck type
   - Charged hours (optional - can edit later in RCTI)

### Step 3: Create Your First RCTI

1. Navigate to **RCTI** page (`/rcti`)
2. **Select Driver** from dropdown (only contractors/subcontractors shown)
3. **Select Week** using navigation buttons
4. Click **"Create RCTI"**

The system will:
- Find all jobs for that driver in the selected week
- Pre-fill hours from job data
- Pre-fill rates from driver pay rates
- Calculate totals based on GST settings

### Step 4: Review and Edit

1. **Check the invoice lines** table
   - Verify hours are correct
   - Adjust rates if needed
   - Edit directly in the table cells

2. **Update driver details** if needed
   - Address, ABN
   - GST settings
   - Bank account info

3. **Add notes** for reference

4. Click **"Save"** to persist changes

### Step 5: Finalise

1. Review all totals (subtotal, GST, total)
2. Click **"Finalise"**
3. RCTI is now locked - no further edits allowed

### Step 6: Mark as Paid (Optional)

1. Once payment is processed
2. Click **"Mark as Paid"**
3. Done!

## 📊 Understanding the UI

### Summary Cards
- **Total RCTIs**: Count for selected period
- **Draft**: Work in progress
- **Finalised**: Locked and ready
- **Paid**: Completed payments
- **Total Amount**: Sum of all RCTIs

### Filters
- **Driver**: Select specific contractor or view all
- **Week**: Navigate weeks (Monday-Sunday)
- **Status**: Filter by draft/finalised/paid

### RCTI Details
When you select an RCTI, you'll see:
- Driver business information (editable in draft)
- Invoice lines table with job details
- Calculated totals with GST breakdown
- Status-specific action buttons

### Invoice Lines Table
| Column | Description | Editable? |
|--------|-------------|-----------|
| Date | Job date | No |
| Customer | Job customer (snapshot) | No |
| Truck Type | Vehicle type | No |
| Description | Pickup → Dropoff | No |
| Hours | Charged hours | Yes (draft only) |
| Rate | Rate per hour | Yes (draft only) |
| Ex GST | Amount excluding GST | Calculated |
| GST | GST amount | Calculated |
| Inc GST | Amount including GST | Calculated |

## 💰 GST Modes Explained

### Not Registered (No GST)
```
Rate: $50/hour × 8 hours = $400
Ex GST: $400
GST: $0
Inc GST: $400
```

### Registered - Exclusive (Rate is ex-GST)
```
Rate: $50/hour × 8 hours = $400 (ex GST)
Ex GST: $400
GST: $40 (10% of $400)
Inc GST: $440
```

### Registered - Inclusive (Rate includes GST)
```
Rate: $55/hour × 8 hours = $440 (inc GST)
Ex GST: $400 ($440 ÷ 1.1)
GST: $40
Inc GST: $440
```

## 🔄 Common Workflows

### Weekly RCTI Creation
```
Monday: Review last week's jobs
Tuesday: Create draft RCTIs for all contractors
Wednesday: Review and adjust hours/rates
Thursday: Finalise all RCTIs
Friday: Process payments and mark as paid
```

### Bulk Processing
```
1. Filter by status: "Draft"
2. For each RCTI:
   - Review totals
   - Click "Finalise"
3. Process bank payments
4. For each RCTI:
   - Click "Mark as Paid"
```

### Corrections
```
If RCTI is finalised but needs changes:
1. Click "Unfinalise"
2. Make corrections
3. Click "Save"
4. Click "Finalise" again
```

## ⚠️ Important Rules

### Jobs Can Only Be Used Once
- Each job can only appear in ONE RCTI
- Once included, it won't appear in future RCTI creation
- This prevents double-billing

### Status Transitions
```
Draft → Finalised → Paid
  ↓        ↓
  ✓ Can edit
  ✓ Can delete
  ✓ Can finalise
           ↓
           ✓ Cannot edit
           ✓ Cannot delete
           ✓ Can unfinalise
           ✓ Can mark as paid
                    ↓
                    ✓ Cannot edit
                    ✓ Cannot delete
                    ✓ Cannot unfinalise
```

### RCTI vs Jobs.invoiced
- RCTI finalization does NOT affect `Jobs.invoiced` field
- These are separate workflows:
  - **Jobs.invoiced**: Customer billing status
  - **RCTI**: Contractor payment status

## 🐛 Troubleshooting

### "No eligible jobs found"
**Causes:**
- No jobs exist for this driver in this week
- All jobs already used in other RCTIs
- Jobs outside the Monday-Sunday range

**Solution:**
- Check Jobs page for that driver
- Verify date range
- Check if jobs are in another RCTI

### "RCTIs can only be created for contractors and subcontractors"
**Cause:** Driver type is "Employee"

**Solution:** Change driver type to "Contractor" or "Subcontractor" in Drivers page

### Totals Don't Match
**Causes:**
- Banker's rounding (rounds half to even)
- Wrong GST mode selected
- GST status incorrect

**Solution:**
- Check GST settings match driver's registration
- Verify mode (inclusive vs exclusive)
- Calculator uses banker's rounding for accuracy

### Cannot Edit RCTI
**Cause:** Status is "Finalised" or "Paid"

**Solution:** Click "Unfinalise" to revert to draft (if not paid)

## 📱 Quick Tips

1. **Use descriptive notes** - Add payment references, special notes
2. **Set up drivers completely** - Fill in all business details upfront
3. **Review before finalizing** - Cannot edit once locked
4. **Regular weekly schedule** - Create consistent workflow
5. **Check invoice numbers** - Format: RCTI-YYYYMMDD-NNNN
6. **Keep snapshots** - RCTIs preserve data even if jobs change

## 🔗 Related Pages

- `/rcti` - RCTI management page
- `/drivers` - Set up contractor details
- `/jobs` - View jobs included in RCTIs

## 📚 Further Reading

- [RCTI_README.md](docs/RCTI_README.md) - Complete user guide
- [RCTI_PLAN.md](RCTI_PLAN.md) - Feature specification
- [RCTI_IMPLEMENTATION.md](RCTI_IMPLEMENTATION.md) - Technical details

## 🎯 Success Criteria

You're ready when you can:
- [ ] Create a contractor driver
- [ ] Add jobs for that driver
- [ ] Generate an RCTI
- [ ] Edit hours and rates
- [ ] Finalise the RCTI
- [ ] Mark it as paid

**Happy invoicing!** 🎉