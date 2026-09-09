CREATE TABLE IF NOT EXISTS ai_chat_rate_limits (
  user_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_rate_limits_expiry
  ON ai_chat_rate_limits(expires_at);