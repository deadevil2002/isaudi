-- Create a unique index on subscriptions(userId) to support ON CONFLICT(userId)
-- This is necessary because the D1 table uses 'id' as the PK instead of 'userId'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_userid_unique ON subscriptions(userId);
