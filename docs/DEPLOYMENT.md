# Deployment and CI/CD Guide

This document outlines the deployment process and continuous integration setup for the worklog application.

## GitHub Actions Workflow

### Automated Testing on PRs

The workflow (`.github/workflows/test.yml`) automatically runs when:
- Pull requests are opened against `main` or `development` branches
- Code is pushed to `main` or `development` branches

### Workflow Jobs

#### 1. Unit Tests Job
- **Runtime**: ~1-2 minutes
- **Actions**:
  - Install Node.js LTS and dependencies
  - Run Jest unit tests (`npm test`)
  - Run ESLint linting (`npm run lint`)
  - Perform TypeScript type checking (`npx tsc --noEmit`)

#### 2. E2E Tests Job
- **Runtime**: ~5-10 minutes
- **Actions**:
  - Set up PostgreSQL test database
  - Install Playwright browsers
  - Generate Prisma client and push database schema
  - Build Next.js application
  - Start application server
  - Run Playwright E2E tests (`npm run test:e2e`)
  - Upload test reports on failure

#### 3. Test Results Job
- Aggregates results from both test jobs
- Provides clear pass/fail status
- Blocks PR merge if any tests fail

## Repository Setup

### Required Secrets

Configure these in GitHub Repository Settings > Secrets and variables > Actions:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_secret_key

# Optional: Google Drive Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Branch Protection Rules

Recommended settings for `main` branch:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - Required checks: `Unit Tests`, `E2E Tests`, `Test Results`
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

## Local Development

### Environment Setup

1. Copy environment variables:
```bash
cp .env.example .env.local
```

2. Fill in your values in `.env.local`

3. Set up database:
```bash
npx prisma generate
npx prisma db push
```

### Running Tests Locally

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (requires running app)
npm run dev &
npm run test:e2e

# All quality checks
npm run lint
npx tsc --noEmit
```

## Production Deployment

### Vercel (Recommended)

1. **Connect Repository**
   - Import project from GitHub
   - Select `main` branch for production

2. **Environment Variables**
   ```bash
   DATABASE_URL=your_production_database_url
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key
   CLERK_SECRET_KEY=sk_live_your_key
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account
   GOOGLE_PRIVATE_KEY=your_private_key
   ```

3. **Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm ci`

4. **Database Setup**
   - Run migrations: `npx prisma migrate deploy`
   - Generate client: `npx prisma generate`

### Alternative Platforms

#### Netlify
- Use `npm run build` and deploy `.next` folder
- Configure environment variables in site settings

#### Railway/Render
- Connect GitHub repository
- Set environment variables
- Use automatic deployments from `main` branch

## Database Management

### Migrations

```bash
# Development
npx prisma migrate dev --name "description"

# Production
npx prisma migrate deploy
```

### Database Seeding

```bash
npm run db:seed
```

## Monitoring and Logs

### Application Monitoring
- Use Vercel Analytics or similar
- Monitor Core Web Vitals
- Track error rates and performance

### Error Tracking
- Consider Sentry integration
- Monitor Clerk authentication errors
- Track database connection issues

## Security Considerations

### Environment Variables
- Never commit `.env.local` to version control
- Use different keys for development/production
- Rotate secrets regularly

### Database Security
- Use connection pooling
- Enable SSL for production connections
- Regular backup strategy

### Authentication
- Configure Clerk webhook endpoints
- Set up proper CORS policies
- Monitor suspicious authentication attempts

## Troubleshooting

### Common CI/CD Issues

1. **Test Failures**
   ```bash
   # Check logs in GitHub Actions
   # Run tests locally
   npm test
   npm run test:e2e
   ```

2. **Build Failures**
   ```bash
   # Check environment variables
   # Verify dependencies
   npm ci
   npm run build
   ```

3. **Database Issues**
   ```bash
   # Reset local database
   npx prisma migrate reset
   npx prisma db push
   ```

### Performance Issues
- Review bundle analysis
- Optimize images and assets
- Check database query performance
- Monitor Lighthouse scores

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Tests passing locally and in CI
- [ ] Build successful
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Monitoring and alerts configured