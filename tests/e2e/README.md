# E2E Tests

End-to-end tests for the WorkLog application using Playwright.

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root with the following test credentials:

```bash
TEST_USER=tester@gwtpt.com.au
TEST_PASS=Tester_2025!
```

**Note:** These environment variables are already configured in your `.env.local` file. The Playwright config automatically loads them.

### 3. Ensure Dev Server is Running

The tests require the development server to be running on `http://localhost:3000`.

```bash
pnpm dev
```

The Playwright configuration will attempt to reuse an existing server if one is already running.

## Running Tests

### Run All E2E Tests

```bash
pnpm exec playwright test tests/e2e
```

### Run Specific Test File

```bash
pnpm exec playwright test tests/e2e/job-creation-with-attachment.spec.ts
```

### Run Tests in UI Mode (Recommended for Development)

```bash
pnpm exec playwright test --ui
```

### Run Tests in Debug Mode

```bash
pnpm exec playwright test --debug
```

### Run Tests with Specific Browser

```bash
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
```

## Test Files

### `smoke.spec.ts`
Basic smoke tests that verify all main pages load correctly.

### `job-creation-with-attachment.spec.ts` ✅
**Status:** Working (requires Google Drive integration)

Tests the complete workflow of:
1. Navigating to the Jobs page
2. Creating a new job with required fields (Driver, Truck Type, Customer, Pickup)
3. Opening the job in edit mode
4. Switching to Attachments tab
5. Uploading a runsheet PDF attachment (`tests/resources/example-runsheet.pdf`)
6. Selecting "Runsheet" as the attachment type
7. Verifying the file uploads successfully to Google Drive
8. Verifying the runsheet checkbox is automatically ticked in Job Details
9. Saving the job with the attachment
10. Verifying the runsheet indicator appears in the job list

**Duration:** ~47 seconds

**Prerequisites:**
- Google Drive integration must be configured
- Valid Google Drive API credentials in environment variables

### `job-creation-simple.spec.ts` ✅
**Status:** Working (no external dependencies)

A simpler test that creates a job and manually checks the runsheet checkbox without uploading files:
1. Creates a job with required fields
2. Manually checks the runsheet checkbox
3. Saves the job
4. Verifies the runsheet indicator appears in the job list
5. Re-opens the job to confirm the checkbox state persists

**Duration:** ~24 seconds

## Test Resources

Test files (like PDF attachments) are stored in `tests/resources/`:
- `example-runsheet.pdf` - Sample runsheet PDF for attachment testing

## Viewing Test Results

After running tests, view the HTML report:

```bash
pnpm exec playwright show-report
```

Screenshots and traces are captured on failure and stored in:
- `playwright-report/` - HTML report
- `test-results/` - Test artifacts (screenshots, traces)

## Test Results

Both tests are now **passing** ✅

- `job-creation-simple.spec.ts`: Creates job and manually sets runsheet checkbox
- `job-creation-with-attachment.spec.ts`: Creates job and uploads PDF attachment to Google Drive

## Troubleshooting

### Tests Fail with "Connection Refused"

Ensure the dev server is running on `http://localhost:3000`:

```bash
pnpm dev
```

### Authentication Failures

Verify that the `TEST_USER` and `TEST_PASS` environment variables are set correctly in `.env.local`.

### "Add Attachments" Button Disabled

The attachment upload test requires Google Drive integration to be configured:
1. Go to Settings → Integrations in the application
2. Configure Google Drive API credentials
3. Ensure the credentials are available in the test environment

### Timeout Errors

If tests are timing out, the application may be loading slowly. You can increase timeouts in `playwright.config.ts`:

```typescript
timeout: 120000, // Increase from 60000
```

### Element Not Found

The UI may have changed. Update the selectors in the test file to match the current implementation.

### Upload Failures

If file uploads fail:
- Verify Google Drive API quota hasn't been exceeded
- Check network connectivity
- Ensure the test file exists at `tests/resources/example-runsheet.pdf`

## Best Practices

1. **Keep tests independent**: Each test should be able to run in isolation
2. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
3. **Wait for network idle**: Use `waitForLoadState('networkidle')` after navigation
4. **Clean up test data**: Consider adding cleanup steps if tests create data that persists
5. **Australian English**: All test strings should use Australian English spelling (e.g., "finalised" not "finalized")

## CI/CD

Tests are configured to run in CI with:
- 2 retries on failure
- Single worker (sequential execution)
- HTML report generation

See `playwright.config.ts` for full configuration.

## Success Criteria

A successful test run should show:
- ✅ Login successful
- ✅ Job created with all required fields
- ✅ Attachment uploaded (if using attachment test)
- ✅ Runsheet checkbox checked
- ✅ Job saved successfully
- ✅ Runsheet indicator visible in job list

## Notes

- The attachment test uploads real files to Google Drive - ensure you have a test environment configured
- Tests use keyboard navigation for reliable form filling
- All tests follow Australian English spelling conventions (e.g., "finalised" not "finalized")