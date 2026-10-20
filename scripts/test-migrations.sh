#!/usr/bin/env bash
# Test local de las migraciones contra el Postgres del stack Supabase local.
# Uso: ./scripts/test-migrations.sh
set -euo pipefail

PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-54322}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-postgres}
export PGPASSWORD
DB=mg_test

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -q \
  -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"

# auth schema mínimo (el de Supabase real lo provee la plataforma)
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -q <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb
);
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
SQL

for f in supabase/migrations/*.sql; do
  echo "== $f"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
done

echo "OK: todas las migraciones corrieron sin error"
