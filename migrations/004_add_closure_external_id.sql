-- Migration: Add external_id to closures for stable-ID import deduplication
-- Date: 2026-10-11
-- Description: Lets importers recognise a re-imported upstream record (first
-- user: the OST feed's traffic situation ID) and update it instead of
-- creating a duplicate.

ALTER TABLE closures ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- Partial: rows without an upstream ID (user submissions, ID-less sources)
-- must never collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_closures_source_external_id
    ON closures (source, external_id)
    WHERE external_id IS NOT NULL;

COMMENT ON COLUMN closures.external_id IS 'Upstream record ID, unique per source';
