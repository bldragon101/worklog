# Refactor TODOs

A running list of beneficial, non-urgent refactors identified during development.
These are codebase-wide improvements that were intentionally deferred to keep
individual changes minimal and consistent. None are correctness bugs; each is a
consistency, maintainability or robustness improvement.

## 1. Return authoritative paid IDs from batch pay (optional)

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

## 2. Standardise semantic colour tokens

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
