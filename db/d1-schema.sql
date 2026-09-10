CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  planExpiresAt INTEGER,
  createdAt INTEGER NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verified_at INTEGER,
  email_verify_token TEXT,
  email_verify_token_expires_at INTEGER,
  free_reports_used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  codeHash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS sessions (
  sessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS salla_oauth_states (
  nonceHash TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(sessionId) REFERENCES sessions(sessionId)
);

CREATE INDEX IF NOT EXISTS idx_salla_oauth_states_expiresAt
  ON salla_oauth_states(expiresAt);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  planId TEXT NOT NULL,
  interval TEXT NOT NULL,
  status TEXT NOT NULL,
  startedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerPaymentId TEXT UNIQUE,
  amountHalala INTEGER NOT NULL,
  currency TEXT NOT NULL,
  planId TEXT,
  interval TEXT,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER,
  processedAt INTEGER,
  integrityError TEXT,
  processingToken TEXT,
  receiptClaimedAt INTEGER,
  receiptLeaseToken TEXT,
  receiptEmailSentAt INTEGER,
  receiptEmailId TEXT,
  rawJson TEXT,
  UNIQUE(provider, providerPaymentId)
);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(userId, status, createdAt);

CREATE TABLE IF NOT EXISTS store_connections (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  storeName TEXT,
  storeUrl TEXT,
  accessTokenEncrypted TEXT,
  refreshTokenEncrypted TEXT,
  tokenExpiresAt INTEGER,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_salla_connections_merchant ON salla_connections(merchantId);
CREATE INDEX IF NOT EXISTS idx_salla_connections_user ON salla_connections(userId, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salla_connections_one_merchant_per_user
  ON salla_connections(userId) WHERE userId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salla_connections_authorizer_email ON salla_connections(authorizerEmail, status);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  platform TEXT NOT NULL,
  externalId TEXT,
  title TEXT,
  sku TEXT,
  priceHalala INTEGER,
  inventory INTEGER,
  category TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  reportId TEXT,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  platform TEXT NOT NULL,
  externalId TEXT,
  reportId TEXT,
  totalHalala INTEGER,
  status TEXT,
  itemsCount INTEGER,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  storeId TEXT,
  reportJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  sku TEXT,
  product_name TEXT,
  qty INTEGER NOT NULL,
  allocated_revenue REAL NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(report_id) REFERENCES reports(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_report ON order_items(report_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_name);

CREATE TABLE IF NOT EXISTS product_costs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  purchase_cost_halala INTEGER NOT NULL DEFAULT 0,
  labor_cost_halala INTEGER NOT NULL DEFAULT 0,
  shipping_cost_halala INTEGER NOT NULL DEFAULT 0,
  packaging_cost_halala INTEGER NOT NULL DEFAULT 0,
  ads_cost_per_unit_halala INTEGER NOT NULL DEFAULT 0,
  payment_fee_percent_bps INTEGER NOT NULL DEFAULT 0,
  is_configured INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(product_id),
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_costs_product_id ON product_costs(product_id);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  time_range_start INTEGER NOT NULL,
  time_range_end INTEGER NOT NULL,
  report_id TEXT NOT NULL,
  gross_sales_halala INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_profit_halala INTEGER NOT NULL DEFAULT 0,
  margin_pct_x100 INTEGER NOT NULL DEFAULT 0,
  missing_cost_products_count INTEGER NOT NULL DEFAULT 0,
  missing_cost_sales_halala INTEGER NOT NULL DEFAULT 0,
  report_json TEXT NOT NULL,
  UNIQUE(user_id, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_created_at ON report_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_timerange ON report_snapshots(user_id, time_range_start, time_range_end);

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

CREATE TABLE IF NOT EXISTS admin_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_single_super_admin
  ON admin_accounts(role) WHERE role = 'super_admin';

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id, expires_at);

CREATE TABLE IF NOT EXISTS admin_rate_limits (
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, window_start)
);
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_expiry ON admin_rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS admin_password_resets (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  claim_hash TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_transfer_requests (
  id TEXT PRIMARY KEY,
  from_admin_id TEXT NOT NULL,
  target_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  claim_hash TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (from_admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_transfers_pending ON admin_transfer_requests(from_admin_id, expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_hash TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

