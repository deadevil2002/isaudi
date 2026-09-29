-- Hot authentication and token lookups.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expiresAt);
CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users(email_verify_token) WHERE email_verify_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_expires_at ON otp_rate_limits(expires_at);

-- Tenant-scoped dashboard, import, and reporting queries.
CREATE INDEX IF NOT EXISTS idx_store_connections_user_status ON store_connections(userId, status);
CREATE INDEX IF NOT EXISTS idx_store_connections_user_platform ON store_connections(userId, platform);
CREATE INDEX IF NOT EXISTS idx_products_user_external_updated ON products(userId, externalId, updatedAt DESC, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_products_user_sku_updated ON products(userId, sku, updatedAt DESC, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_external ON orders(userId, externalId);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created ON orders(userId, status, createdAt);
CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_report ON order_items(report_id);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_end ON report_snapshots(user_id, time_range_end DESC);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_source ON report_snapshots(user_id, source_hash);

-- Bounded Admin pagination ordered by newest rows.
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_store_connections_created_at ON store_connections(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action_created ON admin_audit_log(action, created_at DESC);
