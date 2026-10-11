-- Rollback Migration: Remove external_id from closures
-- Date: 2026-10-11
-- Description: Rollback for stable-ID import deduplication

DROP INDEX IF EXISTS uq_closures_source_external_id;

ALTER TABLE closures DROP COLUMN IF EXISTS external_id;
