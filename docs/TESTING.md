# Testing Guide

This project uses Jest for unit testing and Playwright for E2E testing.

## Setup Complete ✅

### Testing Tools Installed
- **Jest** - Unit testing framework
- **React Testing Library** - React component testing utilities  
- **Playwright** - End-to-end testing framework
- **@testing-library/jest-dom** - Additional Jest matchers

### Configuration Files
- `jest.config.js` - Jest configuration with Next.js integration
- `jest.setup.js` - Test setup with mocks for Clerk and Next.js
- `playwright.config.ts` - Playwright configuration for E2E tests

## Available Commands

### Unit Tests
```bash
npm test                # Run all Jest tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

### E2E Tests
```bash
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Run with interactive UI
npm run test:e2e:headed # Run with browser UI visible
```

## Test Structure

### Unit Tests (`tests/unit/`)
- **`utils.test.ts`** - Tests for utility functions (cn function)
- **`validation.test.ts`** - Tests for Zod validation schemas
- **`types.test.ts`** - Tests for TypeScript type definitions
- **`components.test.tsx`** - Tests for UI components (Button, Input, Badge)
- **`vehicle-columns.test.tsx`** - Tests for vehicle data table columns
- **`vehicles-page.test.tsx`** - Tests for vehicle page logic and operations
- **`job-columns.test.tsx`** - Tests for job data table columns
- **`jobs-page.test.tsx`** - Tests for job page logic, filtering, and operations

### E2E Tests (`tests/e2e/`)
- **`landing-page.spec.ts`** - Landing page navigation tests
- **`customers.spec.ts`** - Customer management workflow tests
- **`vehicles.spec.ts`** - Vehicle page interaction and form tests
- **`jobs.spec.ts`** - Job page filtering, form submission, and status update tests

## Test Coverage

### Current Tests Cover:
✅ **Validation Schemas**
- Job/WorkLog validation
- Customer validation  
- Vehicle validation
- Input sanitization
- Request body validation

✅ **Utility Functions**
- CSS class name merging (cn function)
- Conditional class handling
- Tailwind class conflicts

✅ **Type Definitions**
- Customer, Job, Vehicle, Driver types
- Nullable field handling
- Type structure validation

✅ **UI Components**
- Button variants and states
- Input field behavior
- Badge component rendering

✅ **E2E Workflows**
- Landing page navigation
- Customer data table interactions  
- Vehicle management workflows
- Job management and filtering
- Form handling and validation

## Mocked Dependencies

### Authentication (Clerk)
- `useUser` hook mocked with test user
- `SignedIn`/`SignedOut` components mocked
- `UserButton` component mocked

### Next.js Router
- `useRouter`, `useSearchParams`, `usePathname` mocked
- Navigation functions mocked

### Environment
- Test environment variables configured
- NODE_ENV set to 'test'

## Running Tests

All tests are passing ✅ (96/96 tests pass)

### Test Results Summary:
- **Unit Tests**: 96 tests passing
- **Test Suites**: 8 suites passing  
- **Coverage**: Available via `npm run test:coverage`
- **Performance**: Tests run in ~1.1 seconds

## Adding New Tests

### For Unit Tests:
1. Create test files in `tests/unit/`
2. Import required testing utilities
3. Mock external dependencies as needed
4. Follow existing patterns for component/function testing

### For E2E Tests:
1. Create spec files in `tests/e2e/`
2. Use Playwright test patterns
3. Handle authentication state for protected routes
4. Test user workflows end-to-end

## Notes

- Jest configuration includes path mapping for `@/` imports
- All tests use `@testing-library/jest-dom` for enhanced matchers
- Console logs from validation functions are expected in test output
- Playwright tests require development server to be running
- Tests ignore build directories and node_modules