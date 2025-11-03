-- RCTI Status Update Migration
-- Updates status values from American to Australian English spelling
-- Safe to run multiple times (idempotent)

BEGIN;

-- Update existing RCTIs with "finalized" status to "finalised"
UPDATE "Rcti"
SET status = 'finalised',
    "updatedAt" = NOW()
WHERE status = 'finalized';

-- Verify the update
-- SELECT status, COUNT(*) as count
-- FROM "Rcti"
-- GROUP BY status
-- ORDER BY status;

COMMIT;

-- Expected status values after migration:
-- 'draft'     - Unchanged
-- 'finalised' - Updated from 'finalized' (Australian English)
-- 'paid'      - Unchanged

-- Note: This migration is only needed if you have existing data
-- New RCTIs created after the code update will automatically use 'finalised'
