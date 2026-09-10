-- Single-use Salla Easy Mode ownership linking.
-- Create-only statements keep this migration safe to retry.
CREATE TABLE IF NOT EXISTS salla_link_codes (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  codeHash TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  consumedAt INTEGER,
  invalidatedAt INTEGER,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_salla_link_codes_one_active_per_user
  ON salla_link_codes(userId)
  WHERE consumedAt IS NULL AND invalidatedAt IS NULL;

CREATE INDEX IF NOT EXISTS idx_salla_link_codes_expiry
  ON salla_link_codes(expiresAt);

CREATE TABLE IF NOT EXISTS salla_link_claims (
  merchantId TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,
  linkCodeId TEXT NOT NULL UNIQUE,
  claimedAt INTEGER NOT NULL,
  FOREIGN KEY(merchantId) REFERENCES salla_connections(merchantId),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(linkCodeId) REFERENCES salla_link_codes(id)
);

CREATE INDEX IF NOT EXISTS idx_salla_link_claims_user
  ON salla_link_claims(userId, claimedAt);

CREATE TRIGGER IF NOT EXISTS trg_salla_connection_owner_immutable
BEFORE UPDATE OF userId ON salla_connections
WHEN OLD.userId IS NOT NULL AND NEW.userId IS NOT OLD.userId
BEGIN
  SELECT RAISE(ABORT, 'salla merchant ownership is immutable');
END;