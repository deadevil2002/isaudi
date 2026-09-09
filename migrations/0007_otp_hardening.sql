CREATE TABLE IF NOT EXISTS otp_challenges (
  email TEXT PRIMARY KEY,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at ON otp_challenges(expires_at);

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key_hash, window_start)
);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_window_start ON otp_rate_limits(window_start, expires_at);

-- Some installations never had the legacy table; ensure cleanup is portable.
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  codeHash TEXT,
  attempts INTEGER DEFAULT 0,
  expiresAt INTEGER,
  createdAt INTEGER
);
-- Legacy rows are ephemeral and must not be carried into the hardened flow.
DELETE FROM otp_codes;