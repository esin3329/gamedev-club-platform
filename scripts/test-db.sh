#!/bin/bash
# Database RLS Policy Tests
# 
# This script sets up a local PostgreSQL database with the schema and
# RLS policies, then runs the RLS tests.
#
# Prerequisites: PostgreSQL installed and running
# Usage: npm run test:db

set -e

DB_NAME="gamedev_test"
DB_USER="postgres"

echo "=== Database RLS Policy Tests ==="
echo ""

# Check if PostgreSQL is running
if ! sudo -u postgres pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  sudo service postgresql start
  sleep 2
fi

# Drop and recreate test database
echo "Creating test database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"

# Run migrations
echo "Running migrations..."
sudo -u postgres psql -d $DB_NAME -f supabase/tests/setup.sql
sudo -u postgres psql -d $DB_NAME -f supabase/migrations/00001_initial_schema.sql
sudo -u postgres psql -d $DB_NAME -f supabase/migrations/00002_rls_policies.sql
sudo -u postgres psql -d $DB_NAME -f supabase/migrations/00003_notices_and_events.sql
sudo -u postgres psql -d $DB_NAME -f supabase/migrations/00004_pending_validations.sql

# Run tests
echo ""
echo "Running RLS tests..."
echo ""
sudo -u postgres psql -d $DB_NAME -f supabase/tests/rls.test.sql

# Cleanup
echo ""
echo "Cleaning up..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

echo ""
echo "=== Tests Complete ==="
