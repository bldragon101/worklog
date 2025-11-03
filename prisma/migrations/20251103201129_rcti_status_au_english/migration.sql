-- RCTI Status Update Migration
-- Updates status values from American to Australian English spelling
-- Safe to run multiple times (idempotent)

-- Update existing RCTIs with "finalized" status to "finalised"
UPDATE "public"."Rcti"
SET status = 'finalised',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE status = 'finalized';

-- Expected status values after migration:
-- 'draft'     - Unchanged
-- 'finalised' - Updated from 'finalized' (Australian English)
-- 'paid'      - Unchanged
