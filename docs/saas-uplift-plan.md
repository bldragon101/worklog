# SaaS Uplift Development Plan

## Overview
This document outlines a phased plan to uplift the application from a single‑customer model to a multi‑tenant SaaS model with organisations, scoped data, and role‑based access. It reflects the following decisions:

- Single database multi‑tenancy.
- Roles: owner, admin, member, read‑only.
- Billing and plans are a later phase.
- Migrate all existing data into the first organisation.
- Users can belong to multiple organisations.
- Manual member addition only (no invite flow in MVP).
- Read‑only users cannot export data.
- Organisation deletion is soft delete.

---

## Phase 0 — Product Decisions and Policies (1–2 days)
**Goal:** Finalise policy decisions to keep the implementation consistent and avoid rework.

**Outcomes**
- Define role capabilities:
  - **Owner**: full control, can transfer ownership, manage billing later.
  - **Admin**: manage members and settings.
  - **Member**: standard create/edit access.
  - **Read‑only**: view‑only, no exports.
- Define organisation lifecycle:
  - Create, rename, suspend, soft delete, restore.
- Define multi‑org behaviour:
  - Users can belong to multiple organisations.
  - Default organisation selection logic (last used or explicitly set).

---

## Phase 1 — Data Model and Migration (2–4 days)
**Goal:** Introduce organisational boundaries in the data model and migrate existing data.

**Core Model Additions**
- `Organisation`
- `OrganisationMember` (join table between users and organisations)
- Optional `OrganisationInvite` omitted for MVP.

**Schema Changes**
- Add `organisationId` to all tenant entities:
  - WorkLog, Customer, Job, Driver, Pricing, and any other organisation‑scoped data.
- Add composite indexes such as `(organisationId, <frequently queried field>)`.
- Add unique constraints scoped by organisation where necessary.

**Migration Steps**
- Create the first organisation.
- Assign all existing records to that organisation.
- Link all existing users to that organisation, with owner or admin role as decided.

**Outcome**
- All data is scoped to a tenant by design, with safe defaults.

---

## Phase 2 — Authentication and Authorisation (3–5 days)
**Goal:** Ensure all access is scoped to organisation membership with role enforcement.

**Organisation Context**
- Resolve the user’s current organisation per request.
- Persist the user’s last‑used organisation.

**Role Enforcement**
- Enforce role‑based permissions in a centralised manner.
- Read‑only users must have no write access and no export privileges.

**Outcome**
- All access paths are protected, consistent, and testable.

---

## Phase 3 — API and Query Scoping (3–6 days)
**Goal:** Apply organisation scoping to every API route and data access.

**Key Changes**
- Add organisation scoping (`organisationId`) to all read/write operations.
- Ensure creates automatically assign `organisationId` from context.
- Reject access for users not in the organisation.

**Shared Helpers**
- Organisation context resolution
- Membership and role checks
- Consistent error responses

**Outcome**
- No possibility of cross‑organisation data access.

---

## Phase 4 — UI/UX for Multi‑Org (4–7 days)
**Goal:** Provide a clear and safe multi‑organisation experience.

**UI Changes**
- Organisation switcher in global navigation.
- Organisation settings page:
  - Manage members and roles (manual additions only).
  - Update organisation details.

**Onboarding**
- Create organisation at sign‑up or first login.
- If a user already belongs to one or more organisations, select last used.

**Context Clarity**
- Show current organisation name in key screens.
- Ensure all tables and filters reflect current organisation.

**Outcome**
- Users can confidently work across multiple organisations.

---

## Phase 5 — Migration Validation and Rollout (2–4 days)
**Goal:** Safely move existing data and confirm correctness.

**Steps**
- Validate all records have `organisationId`.
- Verify all existing users are linked to the initial organisation.
- Rollout to internal users first, then to a pilot group.

**Outcome**
- Safe, verified transition with minimal disruption.

---

## Phase 6 — Quality, Testing, and Hardening (Ongoing)
**Goal:** Ensure correctness under multi‑tenant conditions.

**Testing Focus**
- Data isolation: users cannot access other organisations’ data.
- Role enforcement: read‑only restrictions and admin/owner capabilities.
- Multi‑org switching and context persistence.
- Migration correctness and regression tests.

**Monitoring**
- Log access denials and authorisation errors for auditing.

---

## Later Phase — Billing and Plans (Deferred)
**Goal:** Monetise without structural refactor.

**Future Scope**
- Plan and usage models
- Organisation‑level limits
- Payment provider integration
- Self‑serve upgrades and cancellations

---

## Technical Implementation Strategy (Current Stack)

### Vercel (Hosting and Deployments)
- Use environment‑specific configuration for organisation scoping and role enforcement.
- Validate preview deployments include seeded organisation data for QA.
- Ensure edge or serverless runtime choices align with Clerk auth and Prisma connection handling.

### Neon (PostgreSQL)
- Single database with `organisationId` scoping on all tenant entities.
- Use composite indexes for common lookups such as `(organisationId, createdAt)` and `(organisationId, status)`.
- Enforce soft delete for organisations and ensure queries exclude deleted organisations by default.

### Clerk (Authentication)
- Store organisation membership in the app database, linked to Clerk user IDs.
- Resolve current organisation per request and persist last used organisation per user.
- Centralise role checks to enforce owner/admin/member/read‑only access.

### Google Drive (File Storage)
- Store file metadata with `organisationId` and enforce scoped access on download and list operations.
- Use organisation‑specific folder structure or metadata tagging to reduce cross‑org exposure.
- Ensure read‑only users cannot initiate exports or downloads.

### Resend (Email)
- Use Resend for notifications such as membership changes and organisation updates.
- Include organisation context in all templates and subjects to avoid ambiguity.
- Ensure emails do not expose data from other organisations.

### Prisma (ORM)
- Add `organisationId` to tenant models and enforce it in all queries and mutations.
- Use the singleton Prisma instance and avoid cross‑org access by default.
- Create migration scripts for schema changes and run `pnpx prisma generate` after migrations.

### Next.js App Router
- Use server‑side organisation context resolution for protected routes.
- Ensure all API routes enforce organisation membership and role checks.
- Keep organisation switcher state in server‑validated storage.

---

## Risks and Mitigations
- **Risk:** Missing organisation scoping on a query  
  **Mitigation:** Centralise query helpers and add automated tests.
- **Risk:** Migration errors  
  **Mitigation:** Run staged migrations with validation scripts.
- **Risk:** Role confusion  
  **Mitigation:** Clear UI labels and confirmation prompts for sensitive actions.

---

## Deliverables Summary
- Updated data model with organisation scoping
- Migration plan and execution
- Access control and role enforcement
- Organisation management UI and switcher
- Multi‑tenant test coverage and rollout plan