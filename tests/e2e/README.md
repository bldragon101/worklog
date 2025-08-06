# End-to-End Tests

This directory contains Playwright E2E tests for the worklog application.

## Authentication Setup

### Environment Variables

Create a `.env.local` file with test credentials:

```bash
USERNAME=your-test-user-email@example.com
PASSWORD=your-test-user-password
```

### Test User Account

1. **Create Test Account**: 
   - Register a test user account in your Clerk application
   - Use a dedicated email address (e.g., `test@yourcompany.com`)
   - Set a secure password

2. **Account Permissions**:
   - Ensure the test account has access to all features
   - Test account should be able to create, read, update, delete data
   - Consider using a separate test environment if possible

## Authentication Helper

The `tests/helpers/auth.ts` file provides:

- `login(page)` - Logs in using environment variables
- `logout(page)` - Logs out the current user  
- `ensureAuthenticated(page)` - Ensures user is logged in before tests

## Test Structure

### Authentication Tests (`auth.spec.ts`)
- Login flow with valid credentials
- Logout functionality
- Error handling for invalid credentials
- Session persistence across pages
- Redirect behavior for unauthenticated users

### Protected Page Tests
- `customers.spec.ts` - Customer management workflows
- `vehicles.spec.ts` - Vehicle management workflows  
- `jobs.spec.ts` - Job management and filtering workflows

### Public Page Tests
- `landing-page.spec.ts` - Unauthenticated user experience

## Running E2E Tests

### Prerequisites

1. **Application Running**:
   ```bash
   npm run dev
   ```

2. **Environment Variables Set**:
   ```bash
   # In .env.local
   USERNAME=your-test-user@example.com
   PASSWORD=your-test-password
   ```

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run tests with debugging
npx playwright test --debug
```

## Test Configuration

### Timeouts
- **Global test timeout**: 60 seconds
- **Action timeout**: 10 seconds  
- **Navigation timeout**: 30 seconds

### Retry Strategy
- **Local**: No retries
- **CI**: 2 retries on failure

### Browser Support
- Chromium (primary)
- Firefox
- WebKit (Safari)
- Mobile Chrome (responsive testing)

## Debugging Tests

### Screenshots and Videos
- Screenshots taken on failure
- Videos recorded for failed tests
- Trace files for debugging

### Debug Mode
```bash
# Step through tests interactively
npx playwright test --debug

# Run specific test in debug mode
npx playwright test tests/e2e/auth.spec.ts --debug
```

### Test Reports
```bash
# View HTML report
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions
- Tests run automatically on PRs
- Requires `TEST_USERNAME` and `TEST_PASSWORD` secrets
- PostgreSQL database automatically set up
- Application built and started before tests

### Secrets Configuration
In GitHub repository settings, add:
- `TEST_USERNAME` - Test user email
- `TEST_PASSWORD` - Test user password

## Best Practices

### Test Data
- Use consistent test data that won't interfere with other tests
- Clean up test data when possible
- Use unique identifiers (timestamps, UUIDs) for test records

### Test Isolation
- Each test should be independent
- Use `beforeEach` hooks to ensure clean state
- Don't rely on data from previous tests

### Error Handling
- Tests include proper error handling
- Multiple selector strategies for robust element finding
- Graceful handling of timing issues

### Security
- Never commit real credentials to version control
- Use dedicated test accounts, not production accounts
- Regularly rotate test account passwords

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   ```bash
   # Check environment variables
   echo $USERNAME
   echo $PASSWORD
   
   # Verify test account exists
   # Try logging in manually
   ```

2. **Timeout Issues**
   ```bash
   # Increase timeouts in playwright.config.ts
   # Check application startup time
   # Verify database connections
   ```

3. **Element Not Found**
   ```bash
   # Use multiple selector strategies
   # Check for dynamic loading states
   # Verify component test IDs match
   ```

4. **Database Issues**
   ```bash
   # Reset test database
   npx prisma migrate reset
   npx prisma db push
   ```

### Debug Checklist
- [ ] Application running on correct port (3000)
- [ ] Environment variables set correctly
- [ ] Test account credentials valid
- [ ] Database schema up to date
- [ ] No other processes blocking ports
- [ ] Network connectivity working