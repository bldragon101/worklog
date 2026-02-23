# Golden Data Test Fixtures

This directory contains the golden data set used for testing the worklog application. The golden data provides a consistent, realistic set of test data that can be seeded into the database for both E2E (Playwright) and integration (Jest) tests.

## Overview

The golden data set includes:

| Entity | Count | Description |
|--------|-------|-------------|
| Vehicles | 8 | Various types: TRAY, CRANE, SEMI, SEMI CRANE, TRAILER |
| Drivers | 6 | Mix of Employees and Subcontractors with different GST configurations |
| Customers | 6 | Various pricing configurations and settings |
| Jobs | ~33 | Spread across 8 weeks (6 past, current, 2 future) |
| RCTIs | 7 | Various statuses: draft, finalised, paid |
| Deductions | 5 | Various frequencies and statuses |

## Key Features

### Dynamic Date Generation

Jobs are generated **relative to the current date**, ensuring that:
- Week-ending filters work correctly
- Jobs span from 6 weeks ago to 2 weeks in the future
- The current week always has jobs to test with

### Test Data Identification

All test data uses a consistent naming prefix:
- Drivers: `Test Driver Alpha`, `Test Subbie Gamma`, etc.
- Customers: `Test Customer Acme`, `Test Customer BuildCo`, etc.
- Vehicles: `TEST-TRAY01`, `TEST-CRANE01`, etc.
- Job References: `JOB-W-6-001`, `JOB-W0-001`, etc.

This makes cleanup reliable without affecting production data.

### Comprehensive Coverage

The data set covers various scenarios:
- **Employee vs Subcontractor** drivers
- **GST Registered vs Not Registered** drivers
- **GST Exclusive vs Inclusive** modes
- **Active, Archived** drivers
- **Draft, Finalised, Paid** RCTI statuses
- **Active, Completed, Cancelled** deduction statuses
- **Weekly, Fortnightly, One-off** deduction frequencies
- Jobs with and without tolls (Eastlink, Citylink)
- Jobs with and without charged hours (completed vs future bookings)

## Usage

### For E2E Tests (Playwright)

The golden data is automatically seeded before E2E tests run via the global setup:

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // ...
});
```

No additional setup is required in individual test files.

### Verifying Golden Data

Run the verification script to ensure golden data is seeded correctly:

```bash
pnpm test:golden
# or
pnpm db:golden:verify
```

This runs 35 verification tests covering all entities and relationships.

### Manual Seeding/Reset

Use the CLI scripts for manual operations:

```bash
# Seed golden data (adds to existing)
pnpm db:golden:seed

# Reset to golden state (cleanup + reseed)
pnpm db:golden:reset

# Clean up test data only
pnpm db:golden:cleanup

# Check current test data status
pnpm db:golden:status

# Verify golden data is correctly seeded
pnpm db:golden:verify
```

## File Structure

```
tests/
├── fixtures/
│   ├── README.md          # This file
│   └── golden-data.ts     # Golden data definitions
├── helpers/
│   ├── auth.ts            # Authentication helpers
│   └── test-db.ts         # Database seeding/cleanup utilities
├── e2e/
│   ├── global-setup.ts    # Playwright global setup (seeds data)
│   ├── global-teardown.ts # Playwright global teardown (cleans up)
│   └── *.spec.ts          # E2E test files
├── integration/
│   ├── setup.ts           # Integration test setup helpers
│   └── *.test.ts          # Integration test files
└── unit/
    └── *.test.ts          # Unit tests (no database needed)
scripts/
├── seed-golden-data.ts    # CLI script for seeding/reset
└── verify-golden-data.ts  # Standalone verification script
```

## Golden Data Details

### Drivers

| Name | Type | GST Status | GST Mode | Notes |
|------|------|------------|----------|-------|
| Test Driver Alpha | Employee | Not Registered | Exclusive | Standard employee |
| Test Driver Beta | Employee | Not Registered | Exclusive | Standard employee |
| Test Subbie Gamma | Subcontractor | Registered | Exclusive | Full bank details |
| Test Subbie Delta | Subcontractor | Registered | Inclusive | Full bank details |
| Test Subbie Epsilon | Subcontractor | Not Registered | Exclusive | Minimal details |
| Test Driver Archived | Employee | Not Registered | Exclusive | Archived for filter tests |

### Customers

| Name | Bill To | Tolls | Break Deduction |
|------|---------|-------|-----------------|
| Test Customer Acme | Acme Corporation | Yes | 0.5 |
| Test Customer BuildCo | BuildCo Industries | Yes | 0.5 |
| Test Customer Construct | Construct Ltd | No | 0 |
| Test Customer Demo | Demo Enterprises | Yes | 0.5 |
| Test Customer Echo | Echo Supplies | Yes | 0.25 |
| Test Customer Foxtrot | Foxtrot Logistics | Yes | 0 |

### Jobs by Week

| Week | Jobs | Notes |
|------|------|-------|
| Week -6 | 2 | Historical, invoiced |
| Week -5 | 3 | Historical, invoiced |
| Week -4 | 4 | Mix of invoiced/not invoiced |
| Week -3 | 4 | Not invoiced |
| Week -2 | 5 | Not invoiced |
| Week -1 | 5 | Last week |
| Week 0 | 5 | Current week |
| Week +1 | 3 | Future bookings (no times) |
| Week +2 | 2 | Future bookings (no times) |

### RCTIs

| Driver | Week | Status | Notes |
|--------|------|--------|-------|
| Test Subbie Gamma | -6 | Paid | Historical paid |
| Test Subbie Delta | -5 | Finalised | Ready for payment |
| Test Subbie Gamma | -4 | Finalised | Older finalised |
| Test Subbie Epsilon | -3 | Draft | Pending review |
| Test Subbie Delta | -2 | Draft | In progress |
| Test Subbie Gamma | -1 | Draft | Current processing |
| Test Subbie Epsilon | -5 | Paid | Historical paid |

## Best Practices

1. **Never modify production data** - The cleanup functions only target test data using the `Test` prefix.

2. **Use appropriate timeouts** - Database seeding can take 30-60 seconds. Set appropriate timeout values in your test hooks.

3. **Isolate test databases** - Use a separate database for testing to avoid conflicts with development data.

4. **Run verification after seeding** - Always run `pnpm db:golden:verify` after seeding to ensure data integrity.

5. **Use E2E tests for database interactions** - Due to Prisma ESM compatibility issues with Jest, use Playwright E2E tests for tests that need real database access.

## Troubleshooting

### Tests fail with "DATABASE_URL not set"

Ensure your `.env` file contains a valid `DATABASE_URL` pointing to your test database.

### Seeding times out

The seeding script has a built-in timeout. If needed, run manually:

```bash
pnpm db:golden:reset
```

### Duplicate key errors

Run cleanup before seeding:

```bash
pnpm db:golden:reset
```

### Verification fails

If verification tests fail after seeding, check:

1. Database connectivity
2. That no other process is modifying test data
3. Run `pnpm db:golden:status` to check entity counts
