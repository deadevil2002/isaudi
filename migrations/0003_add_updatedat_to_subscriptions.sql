-- Migration to fix subscriptions table schema
-- Add updatedAt column and ensure planId exists instead of plan

-- Backfill updatedAt with a sensible value if available, or current timestamp
-- updatedAt already exists in production according to the user context.
UPDATE subscriptions SET updatedAt = CAST((strftime('%s','now')) AS INTEGER) * 1000 WHERE updatedAt IS NULL;
