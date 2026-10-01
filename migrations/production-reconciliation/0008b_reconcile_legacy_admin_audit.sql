-- Production reconciliation precondition:
-- admin_audit_log must have the legacy camelCase schema created before 0009.
-- Apply through wrangler.production-reconciliation.toml before the canonical chain.

DROP INDEX IF EXISTS idx_admin_audit_created;
DROP INDEX IF EXISTS idx_admin_audit_target;

ALTER TABLE admin_audit_log RENAME TO admin_audit_log_legacy_20261001;

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_hash TEXT,
  metadata_json TEXT,
  created_at INTEGER,
  adminUserId TEXT,
  adminEmail TEXT,
  targetType TEXT,
  targetId TEXT,
  metadata TEXT,
  createdAt INTEGER,
  CHECK (created_at IS NOT NULL OR createdAt IS NOT NULL),
  CHECK (created_at IS NULL OR createdAt IS NULL OR created_at = createdAt),
  CHECK (target_type IS NULL OR targetType IS NULL OR target_type = targetType),
  CHECK (target_id IS NULL OR targetId IS NULL OR target_id = targetId),
  CHECK (metadata_json IS NULL OR metadata IS NULL OR metadata_json = metadata),
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE SET NULL
);

INSERT INTO admin_audit_log (
  id, admin_id, action, target_type, target_id, ip_hash, metadata_json, created_at,
  adminUserId, adminEmail, targetType, targetId, metadata, createdAt
)
SELECT
  legacy.id,
  CASE WHEN EXISTS (
    SELECT 1 FROM admin_accounts account WHERE account.id = legacy.adminUserId
  ) THEN legacy.adminUserId ELSE NULL END,
  legacy.action,
  legacy.targetType,
  legacy.targetId,
  NULL,
  legacy.metadata,
  legacy.createdAt,
  legacy.adminUserId,
  legacy.adminEmail,
  legacy.targetType,
  legacy.targetId,
  legacy.metadata,
  legacy.createdAt
FROM admin_audit_log_legacy_20261001 legacy;

-- Normalize legacy-Worker inserts before constraints are evaluated. The nested
-- insert has both projections populated, so these triggers are recursion-safe
-- even when recursive_triggers is enabled. Reusing an id remains a no-op.
CREATE TRIGGER admin_audit_bridge_legacy_insert
BEFORE INSERT ON admin_audit_log
WHEN NEW.created_at IS NULL AND NEW.createdAt IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO admin_audit_log (
    id, admin_id, action, target_type, target_id, ip_hash, metadata_json, created_at,
    adminUserId, adminEmail, targetType, targetId, metadata, createdAt
  ) VALUES (
    NEW.id,
    CASE WHEN EXISTS (
      SELECT 1 FROM admin_accounts account WHERE account.id = NEW.adminUserId
    ) THEN NEW.adminUserId ELSE NULL END,
    NEW.action,
    COALESCE(NEW.target_type, NEW.targetType),
    COALESCE(NEW.target_id, NEW.targetId),
    NEW.ip_hash,
    COALESCE(NEW.metadata_json, NEW.metadata),
    NEW.createdAt,
    NEW.adminUserId,
    NEW.adminEmail,
    COALESCE(NEW.targetType, NEW.target_type),
    COALESCE(NEW.targetId, NEW.target_id),
    COALESCE(NEW.metadata, NEW.metadata_json),
    NEW.createdAt
  );
  SELECT RAISE(IGNORE);
END;

-- Normalize current-Worker inserts into the legacy projection used during the
-- rollback window. No UPDATE or DELETE compatibility is intentionally added.
CREATE TRIGGER admin_audit_bridge_canonical_insert
BEFORE INSERT ON admin_audit_log
WHEN NEW.createdAt IS NULL AND NEW.created_at IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO admin_audit_log (
    id, admin_id, action, target_type, target_id, ip_hash, metadata_json, created_at,
    adminUserId, adminEmail, targetType, targetId, metadata, createdAt
  ) VALUES (
    NEW.id,
    NEW.admin_id,
    NEW.action,
    COALESCE(NEW.target_type, NEW.targetType),
    COALESCE(NEW.target_id, NEW.targetId),
    NEW.ip_hash,
    COALESCE(NEW.metadata_json, NEW.metadata),
    NEW.created_at,
    COALESCE(NEW.adminUserId, NEW.admin_id),
    COALESCE(NEW.adminEmail, (
      SELECT account.email FROM admin_accounts account WHERE account.id = NEW.admin_id
    )),
    COALESCE(NEW.targetType, NEW.target_type),
    COALESCE(NEW.targetId, NEW.target_id),
    COALESCE(NEW.metadata, NEW.metadata_json),
    NEW.created_at
  );
  SELECT RAISE(IGNORE);
END;

CREATE INDEX idx_admin_audit_created
  ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_target
  ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_admin_audit_legacy_created
  ON admin_audit_log(createdAt DESC);
CREATE INDEX idx_admin_audit_legacy_target
  ON admin_audit_log(targetType, targetId);
CREATE INDEX idx_admin_audit_backup_created_20261001
  ON admin_audit_log_legacy_20261001(createdAt DESC);
CREATE INDEX idx_admin_audit_backup_target_20261001
  ON admin_audit_log_legacy_20261001(targetType, targetId);
