#!/bin/sh
# Runs once, when the Postgres volume is first initialised (docker-entrypoint-initdb.d).
# Creates the non-superuser role the API and worker connect as: row-level security does not
# apply to superusers such as POSTGRES_USER. Default privileges cover tables that migrations
# create later as the owner.
set -e
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" \
  -f /opt/vargly/create-app-role.sql
