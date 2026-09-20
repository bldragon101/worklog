-- Zero is now a legitimate explicit driver-hours total meaning "pay nothing".
-- There is no reliable discriminator between legacy sentinel zeroes and
-- intentional zero-hour overrides, so this migration deliberately performs no
-- data rewrite. Any historical normalisation must be a separately reviewed,
-- targeted data operation after inspecting the affected records.
SELECT 1;
