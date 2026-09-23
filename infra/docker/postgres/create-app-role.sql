-- ====================================================================
-- Application database role for the TrueCO API and workers.
--
-- Row-level security does not apply to superusers or BYPASSRLS roles, so the API must
-- NOT connect as the schema owner created by POSTGRES_USER (a superuser in the official
-- image). Run this once per database, as the owner, after `prisma migrate deploy`:
--
--   psql "$OWNER_DATABASE_URL" -v app_password="<strong password>" -f create-app-role.sql
--
-- Then point the API's DATABASE_URL at trueco_app. Keep using the owner for migrations.
-- ====================================================================

SELECT 'CREATE ROLE trueco_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trueco_app') \gexec

ALTER ROLE trueco_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"DBNAME" TO trueco_app;
GRANT USAGE ON SCHEMA public TO trueco_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trueco_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trueco_app;

-- Tables created by future migrations (run as this owner) are granted automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trueco_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trueco_app;
