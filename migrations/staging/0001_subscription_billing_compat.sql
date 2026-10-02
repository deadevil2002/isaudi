-- Staging was created from the portable migration baseline, while the legacy
-- production subscriptions table already contains these billing columns.
-- Keep this reconciliation staging-only; production must not execute it.
ALTER TABLE subscriptions ADD COLUMN tapChargeId TEXT;
ALTER TABLE subscriptions ADD COLUMN amount REAL;
ALTER TABLE subscriptions ADD COLUMN currency TEXT;
