-- ==============================================================================
-- Workforce Vision Platform (WVP) - Database Initialization
-- Single Source of Truth for Schema: Alembic Migrations
-- This file ONLY configures required PostgreSQL extensions and security roles.
-- ==============================================================================

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Prevent TRUNCATE on audit_logs function
CREATE OR REPLACE FUNCTION prevent_audit_truncate()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. TRUNCATE operation is strictly forbidden by policy (ZRU-1125/1115).';
END;
$$ LANGUAGE plpgsql;

-- 3. Grants and application role setup
DO $$
BEGIN
    -- Create wfv_app role if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wfv_app') THEN
        CREATE ROLE wfv_app WITH LOGIN PASSWORD 'wfv_secret_2026';
    END IF;
END
$$;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO wfv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wfv_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wfv_app;

-- Default privileges for future tables created by Alembic (wfv_migrator)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wfv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO wfv_app;
