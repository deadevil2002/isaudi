-- Authoritative Salla Easy Mode identity and credential storage.
-- This is intentionally separate from store_connections so historical CSV rows
-- and legacy OAuth rows remain untouched.
CREATE TABLE IF NOT EXISTS salla_connections (
  merchantId TEXT PRIMARY KEY,
  userId TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  accessTokenEncrypted TEXT,
  refreshTokenEncrypted TEXT,
  tokenExpiresAt INTEGER,
  scopes TEXT,
  authorizerId TEXT,
  authorizerEmail TEXT,
  authorizerName TEXT,
  authorizerRole TEXT,
  installedAt INTEGER,
  appUpdatedAt INTEGER,
  authorizedAt INTEGER,
  updatedAt INTEGER NOT NULL,
  uninstalledAt INTEGER,
  disconnectedAt INTEGER,
  lastEventAt INTEGER NOT NULL DEFAULT 0,
  lastEventType TEXT,
  lastEventPriority INTEGER NOT NULL DEFAULT 0,
  tokenVersion INTEGER NOT NULL DEFAULT 0,
  refreshState TEXT NOT NULL DEFAULT 'idle'
    CHECK(refreshState IN ('idle', 'in_progress', 'uncertain')),
  refreshAttemptId TEXT,
  refreshAttemptStartedAt INTEGER,
  refreshLockToken TEXT,
  refreshLockExpiresAt INTEGER,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_salla_connections_merchant
  ON salla_connections(merchantId);
CREATE INDEX IF NOT EXISTS idx_salla_connections_user
  ON salla_connections(userId, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salla_connections_one_merchant_per_user
  ON salla_connections(userId) WHERE userId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salla_connections_authorizer_email
  ON salla_connections(authorizerEmail, status);