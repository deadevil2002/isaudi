CREATE TABLE IF NOT EXISTS ai_usage_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed')),
  created_at INTEGER NOT NULL,
  lease_expires_at INTEGER NOT NULL,
  finalized_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_operation_created
  ON ai_usage_ledger(user_id, operation, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_active_leases
  ON ai_usage_ledger(user_id, operation, status, lease_expires_at);