# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma generate` - Generate Prisma client (runs automatically on postinstall)
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio for database management

### Database Operations
- `npx prisma db push` - Push schema changes to database
- `npx prisma db seed` - Run database seeds (if configured)
- `npx prisma migrate reset` - Reset database and run all migrations

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
The application has two main models:
- **WorkLog**: Main logging entity with fields for date, driver, customer, truck type, charges, locations, etc.
- **Customer**: Customer management with billing information, contact details, and pricing (fuel levy, tray, crane, semi rates)

### Authentication & Authorization
- Uses Clerk middleware (`src/middleware.ts`) to protect routes
- All API routes require authentication via `requireAuth()` helper (`src/lib/auth.ts`)
- Protected pages use `ProtectedLayout` component which includes sidebar navigation
- User authentication state managed through Clerk's hooks (`useUser`, `SignedIn`, `SignedOut`)

### Key Application Structure

#### API Routes (`src/app/api/`)
- `/worklog` - CRUD operations for work log entries
- `/customers` - Customer management operations
- `/export/` - CSV export functionality for worklog and customers
- `/import/` - CSV import functionality
- `/google-drive/` - Google Drive integration for file uploads
- All routes include rate limiting and input validation

#### Pages (`src/app/`)
- `/` - Landing page for unauthenticated users
- `/overview` - Main dashboard (redirected after sign-in)
- `/customers` - Customer management with enhanced data table
- `/drivers`, `/vehicles`, `/jobs`, `/reports`, `/analytics` - Placeholder pages
- `/sign-in`, `/sign-up` - Authentication pages
- `/user-profile` - User profile management

#### Components (`src/components/`)
- **Data Tables**: `EnhancedDataTable.tsx`, `EnhancedCustomerDataTable.tsx` with advanced filtering
- **Forms**: `WorkLogForm.tsx`, `CustomerForm.tsx` for data entry
- **Layout**: `ProtectedLayout.tsx`, `app-sidebar.tsx` for navigation
- **UI**: shadcn/ui components in `ui/` directory
- **Auth**: Authentication wrappers and account dialogs

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

### Google Drive Integration
- Service account authentication for file operations
- CSV import/export to Google Drive
- Image upload functionality for work logs
- Secure API key management

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

### Authentication
- Wrap protected pages with `ProtectedLayout`
- Use `requireAuth()` helper in API routes
- Check authentication state with Clerk hooks in client components

### Styling
- Use Tailwind CSS classes
- Leverage shadcn/ui components for consistency
- Support both light and dark themes
- Use responsive design patterns

### Form Validation
- Use Zod schemas for all form inputs
- Validate on both client and server side
- Provide clear error messages
- Sanitize inputs to prevent XSS

### API Development
- Always include authentication checks
- Implement rate limiting for all routes
- Use proper HTTP status codes
- Return consistent error response format
- Log security events appropriately

## Important Notes

- Environment variables required: `DATABASE_URL`, Clerk keys, Google service account credentials
- The application uses Clerk's authentication flow with custom sign-in/sign-up pages
- All authenticated routes automatically redirect unauthenticated users
- Google Drive integration requires service account setup (see `docs/GOOGLE_DRIVE_SETUP.md`)
- Security audit completed - see `SECURITY_AUDIT.md` for implemented measures
- Rate limiting is configured with different tiers for various endpoints