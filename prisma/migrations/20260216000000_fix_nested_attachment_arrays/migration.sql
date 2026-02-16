-- Fix nested 2D arrays in attachment columns
-- Some records have URLs stored as {{url}} (2D array) instead of {url} (1D array)
-- This causes Prisma to interpret the inner array as an "object" instead of a string

-- Fix attachmentRunsheet: flatten any 2D arrays to 1D
UPDATE "Jobs"
SET "attachmentRunsheet" = ARRAY(
  SELECT unnest("attachmentRunsheet")
)
WHERE "attachmentRunsheet"::text LIKE '{{%';

-- Fix attachmentDocket: flatten any 2D arrays to 1D
UPDATE "Jobs"
SET "attachmentDocket" = ARRAY(
  SELECT unnest("attachmentDocket")
)
WHERE "attachmentDocket"::text LIKE '{{%';

-- Fix attachmentDeliveryPhotos: flatten any 2D arrays to 1D
UPDATE "Jobs"
SET "attachmentDeliveryPhotos" = ARRAY(
  SELECT unnest("attachmentDeliveryPhotos")
)
WHERE "attachmentDeliveryPhotos"::text LIKE '{{%';
