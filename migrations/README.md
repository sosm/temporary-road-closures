# Database Migrations

This directory contains SQL migration scripts for the OSM Road Closures database.

## Running Migrations

### Using psql

```bash
# Apply migration
psql -U your_username -d osm_closures -f migrations/001_add_transport_and_attribution_fields.sql

# Rollback migration
psql -U your_username -d osm_closures -f migrations/001_add_transport_and_attribution_fields_rollback.sql
```

### Using Docker

If running the database in Docker:

```bash
# Apply migration
docker exec -i osm-closures-db psql -U postgres -d osm_closures < migrations/001_add_transport_and_attribution_fields.sql

# Rollback migration
docker exec -i osm-closures-db psql -U postgres -d osm_closures < migrations/001_add_transport_and_attribution_fields_rollback.sql
```

## Migration History

### 004_add_closure_external_id.sql (2026-10-11)

**Purpose**: Deduplicate re-imported third-party closures by a stable upstream ID (first used by the OST feed)

**Changes:**

- Added nullable `external_id` column (VARCHAR(255))
- Added partial unique index `uq_closures_source_external_id` on `(source, external_id) WHERE external_id IS NOT NULL`, so rows without an ID never collide

**Rollback**: `004_add_closure_external_id_rollback.sql`

**Note**: `create_all` at startup does not add columns to an existing table; run this against any existing database before deploying the OST dedup code.

### 003_widen_avatar_url_to_text.sql (2026-03-05)

**Purpose**: Fix OAuth login failure caused by long avatar URLs (GitHub Issue #18)

**Changes:**

- Changed `avatar_url` column type from `VARCHAR(255)` to `TEXT`
- Prevents `psycopg2.errors.StringDataRightTruncation` errors when OSM/Google return avatar URLs longer than 255 characters

**Rollback**: `003_widen_avatar_url_to_text_rollback.sql`

**Note**: This migration is required for OSM OAuth to work reliably. Run it against production to resolve the issue.

### 002_make_email_nullable_for_oauth.sql (2025-11-19)

**Purpose**: Allow OAuth users without email addresses (e.g., OpenStreetMap)

**Changes:**
- Made `email` column nullable to support OAuth providers that don't provide email
- Added check constraint to ensure either email OR OAuth provider info is present
- Added unique index on (provider, provider_id) to prevent duplicate OAuth accounts
- Updated column comment to clarify email is optional for OAuth users

**Rollback**: `002_make_email_nullable_for_oauth_rollback.sql`

**Note**: This migration is required for OSM OAuth support, as OSM users may not share their email.

### 001_add_transport_and_attribution_fields.sql (2025-01-18)

**Purpose**: Add support for transport mode filtering, data attribution, and polygon geometries

**Changes:**
- Added `transport_mode` column (VARCHAR(50), default: 'all')
- Added `attribution` column (TEXT, nullable)
- Added `data_license` column (VARCHAR(100), nullable)
- Created `transport_mode_enum` type
- Added indexes on `transport_mode` and `attribution`
- Updated geometry column comment to include Polygon support
- Added check constraint for `transport_mode` values

**Rollback**: `001_add_transport_and_attribution_fields_rollback.sql`

## Best Practices

1. **Backup First**: Always backup your database before running migrations
   ```bash
   pg_dump -U postgres osm_closures > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test in Development**: Run migrations in development environment first

3. **Version Control**: Keep all migration scripts in version control

4. **Sequential Naming**: Name migrations with sequential numbers (001, 002, etc.)

5. **Idempotent Migrations**: Use `IF NOT EXISTS` and `IF EXISTS` clauses to make migrations idempotent

6. **Rollback Scripts**: Always create a rollback script for each migration

## Creating New Migrations

When creating a new migration:

1. Create a new SQL file: `XXX_description.sql`
2. Create a rollback file: `XXX_description_rollback.sql`
3. Update this README with migration details
4. Test in development environment
5. Backup production database
6. Apply to production

## Notes

- Migrations should be run in order (001, 002, 003, etc.)
- Never modify a migration that has been applied to production
- If you need to change something, create a new migration
