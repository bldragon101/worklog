# Refactor TODOs

A running list of beneficial, non-urgent refactors identified during development.
These are codebase-wide improvements that were intentionally deferred to keep
individual changes minimal and consistent. None are correctness bugs; each is a
consistency, maintainability or robustness improvement.

## 1. Centralise route-param validation

**Problem.** RCTI route handlers validate the `id` route param with manual
`parseInt(id, 10)` + `isNaN` checks (`[id]/route.ts`, `[id]/pay`,
`[id]/finalize`, `[id]/revert`, `[id]/unfinalize`, `[id]/lines`, `[id]/refresh`).
A few other routes instead define their own local `paramsSchema = z.object({ id: ... })`
(`rcti/[id]/email`, `jobs-report/[id]/email`, `jobs-report/[id]/unfinalise`).
There is no shared validator, so the approach is inconsistent across the codebase.

**Proposed change.** Add a single shared helper in `src/lib/validation.ts`, e.g.
`rctiParamsSchema` (or a generic `validateIdParam`) that parses and validates a
numeric `id`, and migrate **all** RCTI (and ideally jobs-report) routes to it.
Preserve the existing error semantics: return
`NextResponse.json({ error: "Invalid RCTI ID" }, { status: 400, headers: rateLimitResult.headers })`
on failure.

**Scope.** ~8 RCTI routes + ~3 jobs-report routes. Mechanical, low risk.

**Why deferred.** Changing a single route to a local schema would have reduced
consistency with its siblings. Worth doing as one codebase-wide pass.

## 2. Preserve rate-limit headers on auth failure

**Problem.** Every route follows the documented pattern
`if (authResult instanceof NextResponse) return authResult;` (see AGENTS.md
"API Routes Pattern"). On an auth failure this returns the auth response
directly, which does **not** include the route's rate-limit headers. So 401/403
responses are missing `X-RateLimit-*` headers that successful/other error
responses carry.

**Proposed change.** Introduce a small helper that merges the auth
`NextResponse` (status + body) with the route's `rateLimitResult.headers`, and
use it everywhere the auth guard returns early. Alternatively, bake the
rate-limit headers into `requireAuth()`'s failure responses.

**Scope.** Codebase-wide (all authenticated API routes). Low risk if done via a
shared helper.

**Why deferred.** This is the established project-wide convention; fixing only
one route would create inconsistency for negligible benefit. Best done as a
single sweep or by changing the shared `requireAuth`/helper.

## 3. Return authoritative paid IDs from batch pay (optional)

**Context.** `POST /api/rcti/pay-batch` returns `attemptedIds` (the RCTIs it
tried to pay) and `paidCount` (the authoritative count from the status-guarded
`updateMany`). Under concurrent updates, `attemptedIds.length` can exceed
`paidCount`.

**Proposed change (only if a client ever needs the exact paid IDs).** After the
`updateMany`, re-query
`prisma.rcti.findMany({ where: { id: { in: attemptedIds }, status: "paid", paidAt } })`
and derive both the returned ID list and the count from that result so they are
guaranteed consistent.

**Scope.** One route + its tests. Adds one DB query per batch-pay call.

**Why deferred.** The current client only consumes `paidCount`/`skipped`, so the
extra query is not yet justified. Documented here in case requirements change.

## 4. Standardise semantic colour tokens

**Context.** During the RCTI deductions restyle, hard-coded light-only palettes
(`bg-blue-50`, `bg-yellow-50`, `text-red-700`, etc.) were replaced with theme
tokens (`bg-muted/50`, `text-foreground`, `text-red-600 dark:text-red-400`).
Other areas of the app still mix raw Tailwind colour utilities with and without
`dark:` variants.

**Proposed change.** Audit remaining hard-coded colour utilities and either move
to semantic tokens (`bg-muted`, `text-foreground`, `border-border`) or ensure
every semantic colour has a `dark:` counterpart. Consider extracting shared
"info / warning / success / destructive panel" classes to avoid divergence.

**Scope.** UI-wide audit; incremental, low risk.

**Why deferred.** Out of scope for the targeted deductions fix; worth a dedicated
design-consistency pass.
