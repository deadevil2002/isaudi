-- Verified Salla storefront identity and multi-store ownership foundation.
-- Storefront origins are accepted only from the server-side Salla user-info
-- response after its merchant ID matches the authoritative webhook merchant.
ALTER TABLE salla_connections ADD COLUMN storeName TEXT;
ALTER TABLE salla_connections ADD COLUMN storefrontOrigin TEXT;
ALTER TABLE salla_connections ADD COLUMN storefrontOriginSource TEXT;
ALTER TABLE salla_connections ADD COLUMN storefrontOriginVerifiedAt INTEGER;
ALTER TABLE salla_connections ADD COLUMN storefrontOriginVerificationVersion TEXT;

-- Plan limits are enforced when a link code claims a merchant. The previous
-- uniqueness constraints encoded a permanent one-store limit and must not be
-- used for Growth/Business multi-store tenants.
DROP INDEX IF EXISTS idx_salla_connections_one_merchant_per_user;

CREATE INDEX IF NOT EXISTS idx_salla_connections_user_updated
  ON salla_connections(userId, status, updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_salla_connections_user_origin
  ON salla_connections(userId, storefrontOrigin)
  WHERE userId IS NOT NULL AND storefrontOrigin IS NOT NULL;

CREATE TABLE salla_link_claims_v2 (
  merchantId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  linkCodeId TEXT NOT NULL UNIQUE,
  claimedAt INTEGER NOT NULL,
  FOREIGN KEY(merchantId) REFERENCES salla_connections(merchantId),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(linkCodeId) REFERENCES salla_link_codes(id)
);

INSERT INTO salla_link_claims_v2 (merchantId, userId, linkCodeId, claimedAt)
SELECT merchantId, userId, linkCodeId, claimedAt
FROM salla_link_claims;

DROP TABLE salla_link_claims;
ALTER TABLE salla_link_claims_v2 RENAME TO salla_link_claims;

CREATE INDEX idx_salla_link_claims_user
  ON salla_link_claims(userId, claimedAt);
