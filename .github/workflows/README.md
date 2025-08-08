# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### test.yml - Automated Testing

Runs on pull requests and pushes to `main` and `develop` branches.

#### Jobs:

1. **Unit Tests**
   - Runs Jest unit tests
   - Performs linting with ESLint
   - Type checks with TypeScript compiler
   - Fast execution (~1-2 minutes)

2. **E2E Tests**
   - Sets up PostgreSQL test database
   - Builds and starts the application
   - Runs Playwright end-to-end tests
   - Uploads test reports on failure
   - Longer execution (~5-10 minutes)

3. **Test Results**
   - Aggregates results from both test jobs
   - Provides clear success/failure status

## Required Repository Secrets

To run the workflows successfully, configure these repository secrets in GitHub:

### Authentication (Clerk)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for authentication
- `CLERK_SECRET_KEY` - Clerk secret key for server-side operations

### Test Credentials (E2E Tests)
- `TEST_USERNAME` - Email address for test user account
- `TEST_PASSWORD` - Password for test user account

### Optional Environment Variables
- `DATABASE_URL` - Production database URL (for production deployments)

## Local Testing

To test the workflow locally:

```bash
# Run unit tests
npm test

# Run E2E tests (requires running app)
npm run dev &
npm run test:e2e

# Run linting
npm run lint

# Type check
npx tsc --noEmit
```

## Workflow Features

### Performance Optimizations
- **Concurrency Control**: Cancels previous runs on new pushes
- **Node.js Caching**: Speeds up dependency installation
- **Parallel Jobs**: Unit and E2E tests run simultaneously

### Database Setup
- Automatic PostgreSQL service container
- Health checks ensure database readiness
- Prisma schema generation and migration

### Error Handling
- Comprehensive error reporting
- Artifact uploads for failed test reports
- Clear status indicators for each test phase

### Security
- Uses official GitHub Actions
- Secure secret handling
- Fallback values for build-time variables

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**
   - Check PostgreSQL service health
   - Verify DATABASE_URL format
   - Ensure Prisma schema is generated

2. **Build Failures**
   - Check environment variable configuration
   - Verify all dependencies are installed
   - Review TypeScript compilation errors

3. **E2E Test Timeouts**
   - Increase application startup wait time
   - Check port availability (3000)
   - Review Playwright configuration

4. **Authentication Errors**
   - Verify Clerk secrets are set correctly
   - Check that fake keys work for build-only operations
   - Ensure proper environment variable names

### Debugging Steps:

1. Check the Actions tab in GitHub repository
2. Review detailed logs for each job step
3. Download and examine artifact uploads
4. Test locally with same Node.js version (18)
5. Verify all secrets are properly configured

## Workflow Triggers

- **Pull Request**: `main`, `develop` branches
- **Push**: `main`, `develop` branches
- **Manual**: Can be triggered via GitHub Actions tab

The workflow ensures code quality and functionality before merging changes into main branches.