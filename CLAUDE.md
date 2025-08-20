# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run unit tests with Jest
- `npx prisma generate` - Generate Prisma client (runs automatically on postinstall)
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio for database management

### Database Operations
- `npx prisma db push` - Push schema changes to database
- `npx prisma db seed` - Run database seeds (if configured)
- **⚠️ NEVER USE**: `npx prisma migrate reset` - FORBIDDEN: Never reset the database when making changes

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk for user management
- **Data Tables**: TanStack Table for advanced table functionality
- **Theming**: next-themes for dark/light mode

### Database Schema
The application has three main models:
- **WorkLog**: Main logging entity with fields for date, driver, customer, truck type, charges, locations, etc.
- **Customer**: Customer management with billing information, contact details, and pricing (fuel levy, tray, crane, semi rates)
- **Job**: Enhanced job tracking with start/finish times, charged hours calculations, and automatic hours calculation

### Authentication & Authorization
- Uses Clerk middleware (`src/middleware.ts`) to protect routes
- All API routes require authentication via `requireAuth()` helper (`src/lib/auth.ts`)
- Protected pages use `ProtectedLayout` component which includes sidebar navigation
- User authentication state managed through Clerk's hooks (`useUser`, `SignedIn`, `SignedOut`)

### Key Application Structure

#### API Routes (`src/app/api/`)
- `/worklog` - CRUD operations for work log entries
- `/customers` - Customer management operations
- `/jobs` - Job management with start/finish time tracking and charged hours calculation
- `/export/` - CSV export functionality for worklog, customers, and jobs
- `/import/` - CSV import functionality for all entities
- `/google-drive/` - Google Drive integration for file uploads
- All routes include rate limiting and input validation

#### Pages (`src/app/`)
- `/` - Landing page for unauthenticated users
- `/overview` - Main dashboard (redirected after sign-in)
- `/customers` - Customer management with enhanced data table
- `/jobs` - **IMPLEMENTED**: Job management with start/finish time tracking, charged hours calculation, and comprehensive filtering
- `/drivers`, `/vehicles`, `/reports`, `/analytics` - Placeholder pages
- `/sign-in`, `/sign-up` - Authentication pages
- `/user-profile` - User profile management

#### Components (`src/components/`)
- **Data Tables**: `UnifiedDataTable` with mobile card view, `EnhancedDataTable.tsx`, `EnhancedCustomerDataTable.tsx` with advanced filtering
- **Forms**: `WorkLogForm.tsx`, `CustomerForm.tsx`, `JobForm.tsx` for data entry
- **Layout**: `ProtectedLayout.tsx`, `app-sidebar.tsx` for navigation, `PageControls` for date/time filtering
- **UI**: shadcn/ui components in `ui/` directory including time pickers
- **Auth**: Authentication wrappers and account dialogs
- **Entity-specific**: `job/` directory with job columns, form, toolbar, and sheet fields

### Security Features
- Comprehensive input validation with Zod schemas (`src/lib/validation.ts`)
- Rate limiting on all API endpoints (`src/lib/rate-limit.ts`)
- Security headers and configuration (`src/lib/security-*.ts`)
- File upload validation and sanitization
- Error message sanitization to prevent information disclosure

### Data Table Features
The enhanced data tables include:
- Advanced filtering by date ranges, drivers, customers
- Sorting and column visibility controls
- Export to CSV functionality
- Responsive design with mobile-friendly sheets
- Pagination and row selection
- Real-time search and filtering

#### Data Table Filtering Pattern
For implementing faceted filtering in data tables, follow this established pattern:

1. **Column Configuration**: Add custom `filterFn` to column definitions:
   ```typescript
   // For string/array-based filtering
   filterFn: (row, id, value) => {
     const rowValue = row.getValue(id) as string
     if (Array.isArray(value)) {
       return value.includes(rowValue)
     }
     return rowValue === value
   }
   
   // For boolean columns (runsheet/invoiced)
   filterFn: (row, id, value) => {
     const rowValue = row.getValue(id)
     if (Array.isArray(value)) {
       return value.includes(String(rowValue))
     }
     return String(rowValue) === value
   }
   ```

2. **Filter Component**: Use `DataTableFacetedFilterSimple` component with:
   - Individual reset buttons (X icon) next to each active filter
   - Local state management with `useState` and `useEffect` for checkbox synchronization
   - Proper handling of array-based filter values
   - Dynamic option population from all data (not filtered data)

3. **Toolbar Implementation**: 
   - Fetch filter options from complete dataset via API call, not from table data
   - Use independent `useEffect` with empty dependency array to avoid filtered data limitation
   - Organize filters in separate row for better UX
   - Include global search and bulk reset functionality

4. **Filter Options Population**:
   ```typescript
   // CORRECT: Fetch all data for filter options
   useEffect(() => {
     const fetchFilterOptions = async () => {
       const response = await fetch('/api/entity')
       const allData = await response.json()
       // Extract unique values for filter options
     }
     fetchFilterOptions()
   }, [])
   
   // INCORRECT: Using table data (limits options to filtered view)
   // const data = table.getCoreRowModel().rows.map(row => row.original)
   ```

This pattern ensures comprehensive filtering with proper visual feedback and full option availability.

### Jobs Management System
The Jobs module provides comprehensive job tracking with time management capabilities:

#### Core Features
- **Start/Finish Time Tracking**: Jobs can track start and finish times with automatic charged hours calculation
- **Time Picker Integration**: User-friendly time selection using shadcn/ui time picker components
- **Charged Hours Calculation**: Automatic calculation of charged hours based on start/finish times
- **Status Tracking**: Boolean flags for runsheet and invoiced status with inline checkbox updates
- **Mobile Responsive**: Card-based mobile view with essential information display
- **Advanced Filtering**: Year, month, and week-ending date filtering with "Show whole month" option

#### Time Management
- **Flexible Time Input**: Supports both manual time entry and time picker selection
- **ISO DateTime Storage**: Times stored as ISO datetime strings for consistency
- **Null Time Handling**: Graceful handling of empty/null time values
- **Validation**: Comprehensive Zod schema validation for time formats

#### Data Structure
```typescript
interface Job {
  id: number;
  date: string;
  startTime: string | null;     // ISO datetime string
  finishTime: string | null;    // ISO datetime string
  chargedHours: number | null;  // Calculated hours
  // ... other fields
}
```

#### Mobile Card View
Jobs display in a responsive card layout on mobile devices with:
- Date as title with day-of-week display
- Customer name as subtitle
- Driver and truck type as badges
- Inline checkbox toggles for runsheet/invoiced status
- Real-time status updates via API calls

#### Start/Finish Time Feature Implementation
**Key Enhancement**: Jobs now support precise time tracking with automatic charged hours calculation:

1. **Time Picker Integration**:
   - Custom time picker components for start and finish times
   - User-friendly time selection with keyboard and click input
   - Automatic field focus and validation
   - Format: HH:MM with 24-hour time support

2. **Automatic Hours Calculation**:
   - Real-time calculation of charged hours based on start/finish times
   - Handles time differences across day boundaries
   - Updates immediately when either time field changes
   - Displays calculated hours with 2 decimal precision

3. **Data Validation**:
   - Zod schema validation for time formats
   - Supports ISO datetime strings for database storage
   - Graceful handling of null/empty time values
   - Client-side and server-side validation consistency

4. **Database Schema**:
   ```sql
   -- Time fields added to Job table
   startTime    DateTime?  -- Nullable ISO datetime
   finishTime   DateTime?  -- Nullable ISO datetime
   chargedHours Float?     -- Calculated decimal hours
   ```

5. **Business Logic**:
   - Time calculations use date-fns for accuracy
   - Handles edge cases (same day, overnight shifts)
   - Preserves existing workflow when times are not provided
   - Backward compatible with existing job records

### Google Drive Integration
- Service account authentication for file operations
- CSV import/export to Google Drive
- Image upload functionality for work logs
- Secure API key management

### Testing & CI/CD

#### Unit Testing
- **Framework**: Jest with React Testing Library
- **Coverage**: Components, utilities, and business logic
- **Commands**: `npm test` for running unit tests
- **Location**: Tests in `tests/unit/` directory
- **Focus Areas**: Job management, filtering logic, time calculations, data table functionality

#### End-to-End Testing
- **Framework**: Playwright for E2E testing
- **Commands**: `npm run test:e2e` (currently disabled in CI)
- **Location**: Tests in `tests/e2e/` directory
- **Coverage**: Authentication flows, CRUD operations, filtering

#### Continuous Integration
- **Platform**: GitHub Actions (`.github/workflows/test.yml`)
- **Triggers**: Pull requests and pushes to `main` and `development` branches
- **Jobs**:
  - Unit tests with Jest
  - ESLint code quality checks
  - TypeScript compilation validation
  - E2E tests (commented out but available)
- **Database**: PostgreSQL service container for testing
- **Concurrency**: Automatic cancellation of previous runs on new pushes

#### Testing Commands
```bash
npm test              # Run unit tests
npm run lint          # Run ESLint
npx tsc --noEmit      # TypeScript type checking
npm run test:e2e      # Run E2E tests (requires running app)
```

#### Claude Code Permissions
- Configured in `.claude/settings.local.json`
- Pre-approved commands for common development tasks
- Includes database operations, testing, and build commands
- Follows security best practices for automated operations

## Development Guidelines

### File Organization
- Keep related functionality together (e.g., all customer-related files)
- Use TypeScript interfaces for data shapes
- Follow Next.js App Router conventions
- Place reusable components in `src/components/`
- API utilities in `src/lib/`

### Database Migrations
- Always create migrations for schema changes: `npx prisma migrate dev --name description`
- Test migrations on development database before production
- Use Prisma Studio to verify data structure
- **CRITICAL**: NEVER reset the database (`npx prisma migrate reset`) when making any changes to preserve existing data

### Database Performance
- **MANDATORY**: Use composite indexes for multi-column queries:
  ```prisma
  // ✅ Efficient - composite index for common query pattern
  @@index([userId, purpose, isActive])
  
  // ❌ Less efficient - separate single-column indexes
  @@index([userId])
  @@index([purpose])
  @@index([isActive])
  ```
- Design indexes based on actual query patterns (WHERE clauses)
- Consider query frequency and selectivity when creating indexes
- Monitor query performance and add indexes as needed

### Authentication
- Wrap protected pages with `ProtectedLayout`
- Use `requireAuth()` helper in API routes
- Check authentication state with Clerk hooks in client components

### Styling
- Use Tailwind CSS classes
- Leverage shadcn/ui components for consistency
- Support both light and dark themes
- Use responsive design patterns

### UI Element Identification
- **MANDATORY**: All interactive UI elements MUST have a logical `id` attribute in kebab-case format
- Interactive elements include: buttons, inputs, selects, checkboxes, radio buttons, modals, dialogs, cards, tabs, forms
- ID naming convention: `{component-type}-{purpose}-{action}` (e.g., `submit-form-btn`, `user-email-input`, `delete-confirmation-modal`)
- Dynamic IDs should include unique identifiers: `{component-type}-{identifier}-{action}` (e.g., `edit-user-123-btn`, `customer-456-row`)
- Container elements (cards, sections, panels) should have descriptive IDs: `{content-type}-{purpose}-{container-type}` (e.g., `user-profile-card`, `navigation-sidebar`, `data-table-container`)
- This rule applies to ALL new UI components and when modifying existing components
- IDs must be unique within the page and descriptive enough for testing and debugging purposes

### Form Validation
- Use Zod schemas for all form inputs
- Validate on both client and server side
- Provide clear error messages
- Sanitize inputs to prevent XSS

### API Development
- **MANDATORY**: All API routes MUST include authentication and rate limiting
- **CRITICAL**: Always use the singleton Prisma instance to prevent memory leaks:
  ```typescript
  import { prisma } from '@/lib/prisma'; // ✅ Correct - uses singleton
  // NEVER: const prisma = new PrismaClient(); // ❌ Memory leak per request
  ```
- Use `requireAuth()` helper for authentication checks
- Use `createRateLimiter()` for rate limiting protection
- Required security pattern for ALL API routes:
  ```typescript
  import { prisma } from '@/lib/prisma';
  import { requireAuth } from '@/lib/auth';
  import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
  
  const rateLimit = createRateLimiter(rateLimitConfigs.general);
  
  export async function METHOD(request: NextRequest) {
    try {
      // SECURITY: Apply rate limiting
      const rateLimitResult = rateLimit(request);
      if (rateLimitResult instanceof NextResponse) {
        return rateLimitResult;
      }
  
      // SECURITY: Check authentication
      const authResult = await requireAuth();
      if (authResult instanceof NextResponse) {
        return authResult;
      }
  
      // DATABASE: Use singleton Prisma instance
      const result = await prisma.yourModel.findMany();
      
      return NextResponse.json(result, {
        headers: rateLimitResult.headers
      });
    } catch (error) {
      return NextResponse.json({
        error: 'Internal server error'
      }, { status: 500 });
    }
  }
  ```
- Use proper HTTP status codes (401 for auth, 429 for rate limit, 500 for errors)
- Return consistent error response format
- Sanitize error messages to prevent information disclosure
- Log security events appropriately

## Important Notes

- Environment variables required: `DATABASE_URL`, Clerk keys, Google service account credentials
- The application uses Clerk's authentication flow with custom sign-in/sign-up pages
- All authenticated routes automatically redirect unauthenticated users
- Google Drive integration requires service account setup (see `docs/GOOGLE_DRIVE_SETUP.md`)
- Security audit completed - see `SECURITY_AUDIT.md` for implemented measures
- Rate limiting is configured with different tiers for various endpoints
- **Jobs module is fully implemented** with time tracking, mobile responsiveness, and comprehensive testing
- GitHub Actions CI/CD pipeline validates code quality, runs tests, and ensures TypeScript compilation
- Claude Code permissions are pre-configured for development workflow automation