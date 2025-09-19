# AGENTS.md

Quick reference for AI agents working with this codebase.

## Key Principles

- Zero configuration required
- Subsecond performance
- Maximum type safety
- AI-friendly code generation

## Before Writing Code

1. Analyze existing patterns in the codebase
2. Consider edge cases and error scenarios
3. Follow the rules below strictly
4. Validate accessibility requirements
5. Avoid code duplication

## Rules

### Accessibility (a11y)

- Always include a `title` element for icons unless there's text beside the icon.
- Always include a `type` attribute for button elements.
- Accompany `onClick` with at least one of: `onKeyUp`, `onKeyDown`, or `onKeyPress`.
- Accompany `onMouseOver`/`onMouseOut` with `onFocus`/`onBlur`.

### Code Complexity and Quality

- Don't use primitive type aliases or misleading types.
- Don't use the comma operator.
- Use for...of statements instead of Array.forEach.
- Don't initialize variables to undefined.
- Use .flatMap() instead of map().flat() when possible.

### React and JSX Best Practices

- Don't import `React` itself.
- Don't define React components inside other components.
- Don't use both `children` and `dangerouslySetInnerHTML` props on the same element.
- Don't insert comments as text nodes.
- Use `<>...</>` instead of `<Fragment>...</Fragment>`.

### Function Parameters and Props

- Always use destructured props objects instead of individual parameters in functions.
- Example: `function helloWorld({ prop }: { prop: string })` instead of `function helloWorld(param: string)`.
- This applies to all functions, not just React components.

### Correctness and Safety

- Don't assign a value to itself.
- Avoid unused imports and variables.
- Don't use await inside loops.
- Don't hardcode sensitive data like API keys and tokens.
- Don't use the TypeScript directive @ts-ignore.
- Make sure the `preconnect` attribute is used when using Google Fonts.
- Don't use the `delete` operator.
- Don't use `require()` in TypeScript/ES modules - use proper `import` statements.

### TypeScript Best Practices

- Don't use TypeScript enums.
- Use either `T[]` or `Array<T>` consistently.
- Don't use the `any` type.

### Style and Consistency

- Don't use global `eval()`.
- Use `String.slice()` instead of `String.substr()` and `String.substring()`.
- Don't use `else` blocks when the `if` block breaks early.
- Put default function parameters and optional function parameters last.
- Use `new` when throwing an error.
- Use `String.trimStart()` and `String.trimEnd()` over `String.trimLeft()` and `String.trimRight()`.

### Next.js Specific Rules

- Don't use `<img>` elements in Next.js projects.
- Don't use `<head>` elements in Next.js projects.

## Example: Error Handling

```typescript
// ✅ Good: Comprehensive error handling
try {
  const result = await fetchData();
  return { success: true, data: result };
} catch (error) {
  console.error("API call failed:", error);
  return { success: false, error: error.message };
}

// ❌ Bad: Swallowing errors
try {
  return await fetchData();
} catch (e) {
  console.log(e);
}

## Package Manager
**CRITICAL**: Always use `pnpm` (not npm) and `pnpx` (not npx).

## Essential Commands
```bash
pnpm dev          # Start dev server
pnpm build        # Build production
pnpm lint         # Run ESLint
pnpm test         # Run tests
pnpx prisma generate     # Generate Prisma client
pnpx prisma migrate dev  # Run migrations
pnpx prisma studio       # Database GUI
```

## Database Rules
- **NEVER** use `pnpx prisma migrate reset` - preserves existing data
- **ALWAYS** use singleton Prisma instance: `import { prisma } from '@/lib/prisma'`
- Create migrations for schema changes: `pnpx prisma migrate dev --name description`
- Use composite indexes for multi-column queries

## Code Rules

### Critical
- Use destructured props in all functions: `({ prop }: { prop: string })`
- All interactive elements need `id` in kebab-case: `submit-form-btn`
- Don't use `any` type, TypeScript enums, or `@ts-ignore`
- Don't add comments unless requested

### React/Next.js
- Don't import React itself
- Don't use `<img>` or `<head>` in Next.js
- Use `<>...</>` instead of `<Fragment>`
- Always include `type` for buttons

### API Routes Pattern
```typescript
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function METHOD(request: NextRequest) {
  // 1. Rate limiting
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  // 2. Authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  // 3. Use singleton prisma
  const result = await prisma.model.operation();

  return NextResponse.json(result, { headers: rateLimitResult.headers });
}
```

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Clerk
- **UI**: Tailwind CSS + shadcn/ui
- **Tables**: TanStack Table
- **Package Manager**: pnpm

## Project Structure
```
src/
├── app/
│   ├── api/          # API routes (require auth + rate limiting)
│   ├── (protected)/  # Authenticated pages
│   └── page.tsx      # Landing page
├── components/
│   ├── ui/           # shadcn/ui components
│   └── ...           # Feature components
├── lib/
│   ├── prisma.ts     # Singleton instance
│   ├── auth.ts       # requireAuth helper
│   └── rate-limit.ts # Rate limiting
└── middleware.ts     # Clerk middleware
```

## Key Models
- **WorkLog**: Main logging entity
- **Customer**: Customer management with pricing
- **Job**: Time tracking with start/finish times

## Development Workflow
1. Check existing patterns in codebase
2. Use TodoWrite tool for complex tasks
3. Follow existing code conventions
4. Run `pnpm lint` after changes
5. Test with `pnpm test`
6. Never commit unless explicitly asked

## Security
- All API routes need authentication via `requireAuth()`
- All API routes need rate limiting
- Validate inputs with Zod schemas
- Sanitize error messages
- Never log sensitive data

## Data Table Pattern
- Use `DataTableFacetedFilterSimple` for filtering
- Fetch filter options from complete dataset (not filtered data)
- Add custom `filterFn` to column definitions
- Include reset buttons for active filters

## Testing
- Unit tests: `pnpm test`
- Type checking: `pnpx tsc --noEmit`
- E2E tests: `pnpm run test:e2e` (optional)

## Important
- Never reset database when making changes
- Use pnpm, not npm
- Add IDs to all interactive elements
- Follow destructured props pattern
- Check auth in all API routes
