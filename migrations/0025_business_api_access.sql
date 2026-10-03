-- Business-only, read-only iSaudi API credentials and bounded usage telemetry.
-- Plaintext API keys and Authorization headers are never persisted.
CREATE TABLE business_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  expires_at INTEGER,
  rotated_from_id TEXT,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  rate_limit_count INTEGER NOT NULL DEFAULT 0 CHECK (rate_limit_count >= 0),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(rotated_from_id) REFERENCES business_api_keys(id)
);

CREATE INDEX idx_business_api_keys_owner_status
  ON business_api_keys(user_id, status, created_at DESC);
CREATE INDEX idx_business_api_keys_hash_status
  ON business_api_keys(secret_hash, status);

CREATE TABLE business_api_key_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'revoked', 'rotated')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(key_id) REFERENCES business_api_keys(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_api_key_events_owner_time
  ON business_api_key_events(user_id, created_at DESC);

CREATE TABLE business_api_usage_daily (
  day_start INTEGER NOT NULL,
  key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  rate_limit_count INTEGER NOT NULL DEFAULT 0 CHECK (rate_limit_count >= 0),
  latency_total_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_total_ms >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(day_start, key_id, endpoint),
  FOREIGN KEY(key_id) REFERENCES business_api_keys(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_api_usage_day_endpoint
  ON business_api_usage_daily(day_start DESC, endpoint);

CREATE TABLE business_api_admin_summary (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_keys INTEGER NOT NULL DEFAULT 0,
  revoked_keys INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  rate_limit_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);

INSERT INTO business_api_admin_summary (id, updated_at)
VALUES (1, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

CREATE TRIGGER business_api_key_insert
AFTER INSERT ON business_api_keys BEGIN
  UPDATE business_api_admin_summary SET
    active_keys = active_keys + CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
    revoked_keys = revoked_keys + CASE WHEN NEW.status = 'revoked' THEN 1 ELSE 0 END,
    updated_at = NEW.created_at
  WHERE id = 1;
END;

CREATE TRIGGER business_api_key_status_update
AFTER UPDATE OF status ON business_api_keys
WHEN OLD.status <> NEW.status BEGIN
  UPDATE business_api_admin_summary SET
    active_keys = MAX(active_keys + CASE WHEN NEW.status = 'active' THEN 1 ELSE -1 END, 0),
    revoked_keys = MAX(revoked_keys + CASE WHEN NEW.status = 'revoked' THEN 1 ELSE -1 END, 0),
    updated_at = COALESCE(NEW.revoked_at, NEW.created_at)
  WHERE id = 1;
END;

CREATE TRIGGER business_api_key_delete
AFTER DELETE ON business_api_keys BEGIN
  UPDATE business_api_admin_summary SET
    active_keys = MAX(active_keys - CASE WHEN OLD.status = 'active' THEN 1 ELSE 0 END, 0),
    revoked_keys = MAX(revoked_keys - CASE WHEN OLD.status = 'revoked' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE id = 1;
END;
