-- Durable, bounded aggregates for the super-admin observability center.
-- Historical AI rows keep unknown plan/latency/error metadata; new rows are
-- classified at write time so Admin reads never scan the full usage ledger.

ALTER TABLE ai_usage_ledger ADD COLUMN plan TEXT;
ALTER TABLE ai_usage_ledger ADD COLUMN latency_ms INTEGER;
ALTER TABLE ai_usage_ledger ADD COLUMN failure_kind TEXT;
ALTER TABLE ai_usage_ledger ADD COLUMN provider_status INTEGER;

CREATE TABLE IF NOT EXISTS admin_ai_usage_daily (
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'plan', 'user')),
  scope_id TEXT NOT NULL,
  day_start INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('chat', 'generate')),
  model TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  timeout_count INTEGER NOT NULL DEFAULT 0,
  rate_limit_count INTEGER NOT NULL DEFAULT 0,
  provider_error_count INTEGER NOT NULL DEFAULT 0,
  status_2xx_count INTEGER NOT NULL DEFAULT 0,
  status_4xx_count INTEGER NOT NULL DEFAULT 0,
  status_5xx_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  latency_total_ms INTEGER NOT NULL DEFAULT 0,
  latency_samples INTEGER NOT NULL DEFAULT 0,
  latency_le_100 INTEGER NOT NULL DEFAULT 0,
  latency_le_250 INTEGER NOT NULL DEFAULT 0,
  latency_le_500 INTEGER NOT NULL DEFAULT 0,
  latency_le_1000 INTEGER NOT NULL DEFAULT 0,
  latency_le_2500 INTEGER NOT NULL DEFAULT 0,
  latency_le_5000 INTEGER NOT NULL DEFAULT 0,
  latency_gt_5000 INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope_type, scope_id, day_start, operation, model)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_admin_ai_usage_daily_range
  ON admin_ai_usage_daily(scope_type, day_start DESC, scope_id);

INSERT INTO admin_ai_usage_daily (
  scope_type, scope_id, day_start, operation, model,
  request_count, success_count, failure_count,
  input_tokens, output_tokens, total_tokens,
  cached_input_tokens, cache_write_tokens, updated_at
)
SELECT
  'global', 'all', (COALESCE(finalized_at, created_at) / 86400000) * 86400000,
  operation, COALESCE(NULLIF(TRIM(model), ''), 'unknown'),
  COUNT(*),
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END),
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
  SUM(COALESCE(input_tokens, 0)), SUM(COALESCE(output_tokens, 0)),
  SUM(COALESCE(total_tokens, 0)), SUM(COALESCE(cached_input_tokens, 0)),
  SUM(COALESCE(cache_write_tokens, 0)), CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM ai_usage_ledger
WHERE status IN ('succeeded', 'failed')
GROUP BY 3, 4, 5;

INSERT INTO admin_ai_usage_daily (
  scope_type, scope_id, day_start, operation, model,
  request_count, success_count, failure_count,
  input_tokens, output_tokens, total_tokens,
  cached_input_tokens, cache_write_tokens, updated_at
)
SELECT
  'plan', 'unknown', (COALESCE(finalized_at, created_at) / 86400000) * 86400000,
  operation, COALESCE(NULLIF(TRIM(model), ''), 'unknown'),
  COUNT(*),
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END),
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
  SUM(COALESCE(input_tokens, 0)), SUM(COALESCE(output_tokens, 0)),
  SUM(COALESCE(total_tokens, 0)), SUM(COALESCE(cached_input_tokens, 0)),
  SUM(COALESCE(cache_write_tokens, 0)), CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM ai_usage_ledger
WHERE status IN ('succeeded', 'failed')
GROUP BY 3, 4, 5;

INSERT INTO admin_ai_usage_daily (
  scope_type, scope_id, day_start, operation, model,
  request_count, success_count, failure_count,
  input_tokens, output_tokens, total_tokens,
  cached_input_tokens, cache_write_tokens, updated_at
)
SELECT
  'user', user_id, (COALESCE(finalized_at, created_at) / 86400000) * 86400000,
  operation, COALESCE(NULLIF(TRIM(model), ''), 'unknown'),
  COUNT(*),
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END),
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
  SUM(COALESCE(input_tokens, 0)), SUM(COALESCE(output_tokens, 0)),
  SUM(COALESCE(total_tokens, 0)), SUM(COALESCE(cached_input_tokens, 0)),
  SUM(COALESCE(cache_write_tokens, 0)), CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM ai_usage_ledger
WHERE status IN ('succeeded', 'failed')
GROUP BY 2, 3, 4, 5;

CREATE TRIGGER IF NOT EXISTS admin_ai_usage_finalize
AFTER UPDATE OF status ON ai_usage_ledger
WHEN OLD.status = 'reserved' AND NEW.status IN ('succeeded', 'failed')
BEGIN
  INSERT INTO admin_ai_usage_daily (
    scope_type, scope_id, day_start, operation, model,
    request_count, success_count, failure_count, timeout_count,
    provider_error_count, status_2xx_count, status_4xx_count, status_5xx_count,
    input_tokens, output_tokens, total_tokens, cached_input_tokens, cache_write_tokens,
    latency_total_ms, latency_samples, latency_le_100, latency_le_250,
    latency_le_500, latency_le_1000, latency_le_2500, latency_le_5000,
    latency_gt_5000, updated_at
  )
  SELECT
    s.scope_type, s.scope_id, (COALESCE(NEW.finalized_at, NEW.created_at) / 86400000) * 86400000,
    NEW.operation, COALESCE(NULLIF(TRIM(NEW.model), ''), 'unknown'),
    1, CASE WHEN NEW.status = 'succeeded' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    CASE WHEN NEW.failure_kind = 'timeout' THEN 1 ELSE 0 END,
    CASE WHEN NEW.failure_kind IN ('provider', 'network', 'invalid_response') THEN 1 ELSE 0 END,
    CASE WHEN NEW.provider_status BETWEEN 200 AND 299 THEN 1 ELSE 0 END,
    CASE WHEN NEW.provider_status BETWEEN 400 AND 499 THEN 1 ELSE 0 END,
    CASE WHEN NEW.provider_status BETWEEN 500 AND 599 THEN 1 ELSE 0 END,
    COALESCE(NEW.input_tokens, 0), COALESCE(NEW.output_tokens, 0),
    COALESCE(NEW.total_tokens, 0), COALESCE(NEW.cached_input_tokens, 0),
    COALESCE(NEW.cache_write_tokens, 0), COALESCE(NEW.latency_ms, 0),
    CASE WHEN NEW.latency_ms IS NULL THEN 0 ELSE 1 END,
    CASE WHEN NEW.latency_ms BETWEEN 0 AND 100 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms BETWEEN 101 AND 250 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms BETWEEN 251 AND 500 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms BETWEEN 501 AND 1000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms BETWEEN 1001 AND 2500 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms BETWEEN 2501 AND 5000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.latency_ms > 5000 THEN 1 ELSE 0 END,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM (
    SELECT 'global' AS scope_type, 'all' AS scope_id
    UNION ALL SELECT 'plan', COALESCE(NULLIF(TRIM(NEW.plan), ''), 'unknown')
    UNION ALL SELECT 'user', NEW.user_id
  ) s
  WHERE 1
  ON CONFLICT(scope_type, scope_id, day_start, operation, model) DO UPDATE SET
    request_count = request_count + excluded.request_count,
    success_count = success_count + excluded.success_count,
    failure_count = failure_count + excluded.failure_count,
    timeout_count = timeout_count + excluded.timeout_count,
    provider_error_count = provider_error_count + excluded.provider_error_count,
    status_2xx_count = status_2xx_count + excluded.status_2xx_count,
    status_4xx_count = status_4xx_count + excluded.status_4xx_count,
    status_5xx_count = status_5xx_count + excluded.status_5xx_count,
    input_tokens = input_tokens + excluded.input_tokens,
    output_tokens = output_tokens + excluded.output_tokens,
    total_tokens = total_tokens + excluded.total_tokens,
    cached_input_tokens = cached_input_tokens + excluded.cached_input_tokens,
    cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
    latency_total_ms = latency_total_ms + excluded.latency_total_ms,
    latency_samples = latency_samples + excluded.latency_samples,
    latency_le_100 = latency_le_100 + excluded.latency_le_100,
    latency_le_250 = latency_le_250 + excluded.latency_le_250,
    latency_le_500 = latency_le_500 + excluded.latency_le_500,
    latency_le_1000 = latency_le_1000 + excluded.latency_le_1000,
    latency_le_2500 = latency_le_2500 + excluded.latency_le_2500,
    latency_le_5000 = latency_le_5000 + excluded.latency_le_5000,
    latency_gt_5000 = latency_gt_5000 + excluded.latency_gt_5000,
    updated_at = excluded.updated_at;
END;

CREATE TABLE IF NOT EXISTS admin_observability_summary (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  products_count INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  order_items_count INTEGER NOT NULL DEFAULT 0,
  snapshots_count INTEGER NOT NULL DEFAULT 0,
  subscriptions_count INTEGER NOT NULL DEFAULT 0,
  payments_count INTEGER NOT NULL DEFAULT 0,
  payment_success_count INTEGER NOT NULL DEFAULT 0,
  payment_failure_count INTEGER NOT NULL DEFAULT 0,
  payment_integrity_failure_count INTEGER NOT NULL DEFAULT 0,
  connections_count INTEGER NOT NULL DEFAULT 0,
  csv_products_count INTEGER NOT NULL DEFAULT 0,
  csv_orders_count INTEGER NOT NULL DEFAULT 0,
  salla_connected_count INTEGER NOT NULL DEFAULT 0,
  salla_warning_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT INTO admin_observability_summary (
  id, products_count, orders_count, order_items_count, snapshots_count,
  subscriptions_count, payments_count, payment_success_count,
  payment_failure_count, payment_integrity_failure_count, connections_count, csv_products_count,
  csv_orders_count, salla_connected_count, salla_warning_count, updated_at
)
SELECT 1,
  (SELECT COUNT(*) FROM products),
  (SELECT COUNT(*) FROM orders),
  (SELECT COUNT(*) FROM order_items),
  (SELECT COUNT(*) FROM report_snapshots),
  (SELECT COUNT(*) FROM subscriptions),
  (SELECT COUNT(*) FROM payments),
  (SELECT COUNT(*) FROM payments WHERE status IN ('paid', 'captured', 'completed')),
  (SELECT COUNT(*) FROM payments WHERE status IN ('failed', 'declined', 'cancelled', 'canceled', 'expired')),
  (SELECT COUNT(*) FROM payments WHERE integrityError IS NOT NULL),
  (SELECT COUNT(*) FROM store_connections),
  (SELECT COUNT(*) FROM products WHERE platform = 'csv'),
  (SELECT COUNT(*) FROM orders WHERE platform = 'csv'),
  (SELECT COUNT(*) FROM salla_connections WHERE status = 'connected'),
  (SELECT COUNT(*) FROM salla_connections WHERE status <> 'connected'),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
ON CONFLICT(id) DO UPDATE SET
  products_count = excluded.products_count,
  orders_count = excluded.orders_count,
  order_items_count = excluded.order_items_count,
  snapshots_count = excluded.snapshots_count,
  subscriptions_count = excluded.subscriptions_count,
  payments_count = excluded.payments_count,
  payment_success_count = excluded.payment_success_count,
  payment_failure_count = excluded.payment_failure_count,
  payment_integrity_failure_count = excluded.payment_integrity_failure_count,
  connections_count = excluded.connections_count,
  csv_products_count = excluded.csv_products_count,
  csv_orders_count = excluded.csv_orders_count,
  salla_connected_count = excluded.salla_connected_count,
  salla_warning_count = excluded.salla_warning_count,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS admin_obs_product_insert AFTER INSERT ON products BEGIN
  UPDATE admin_observability_summary SET products_count = products_count + 1,
    csv_products_count = csv_products_count + CASE WHEN NEW.platform = 'csv' THEN 1 ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_product_delete AFTER DELETE ON products BEGIN
  UPDATE admin_observability_summary SET products_count = MAX(products_count - 1, 0),
    csv_products_count = MAX(csv_products_count - CASE WHEN OLD.platform = 'csv' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_product_platform AFTER UPDATE OF platform ON products BEGIN
  UPDATE admin_observability_summary SET
    csv_products_count = MAX(csv_products_count - CASE WHEN OLD.platform = 'csv' THEN 1 ELSE 0 END + CASE WHEN NEW.platform = 'csv' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS admin_obs_order_insert AFTER INSERT ON orders BEGIN
  UPDATE admin_observability_summary SET orders_count = orders_count + 1,
    csv_orders_count = csv_orders_count + CASE WHEN NEW.platform = 'csv' THEN 1 ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_order_delete AFTER DELETE ON orders BEGIN
  UPDATE admin_observability_summary SET orders_count = MAX(orders_count - 1, 0),
    csv_orders_count = MAX(csv_orders_count - CASE WHEN OLD.platform = 'csv' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_order_platform AFTER UPDATE OF platform ON orders BEGIN
  UPDATE admin_observability_summary SET
    csv_orders_count = MAX(csv_orders_count - CASE WHEN OLD.platform = 'csv' THEN 1 ELSE 0 END + CASE WHEN NEW.platform = 'csv' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS admin_obs_order_item_insert AFTER INSERT ON order_items BEGIN
  UPDATE admin_observability_summary SET order_items_count = order_items_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_order_item_delete AFTER DELETE ON order_items BEGIN
  UPDATE admin_observability_summary SET order_items_count = MAX(order_items_count - 1, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_snapshot_insert AFTER INSERT ON report_snapshots BEGIN
  UPDATE admin_observability_summary SET snapshots_count = snapshots_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_snapshot_delete AFTER DELETE ON report_snapshots BEGIN
  UPDATE admin_observability_summary SET snapshots_count = MAX(snapshots_count - 1, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_subscription_insert AFTER INSERT ON subscriptions BEGIN
  UPDATE admin_observability_summary SET subscriptions_count = subscriptions_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_subscription_delete AFTER DELETE ON subscriptions BEGIN
  UPDATE admin_observability_summary SET subscriptions_count = MAX(subscriptions_count - 1, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS admin_obs_payment_insert AFTER INSERT ON payments BEGIN
  UPDATE admin_observability_summary SET payments_count = payments_count + 1,
    payment_success_count = payment_success_count + CASE WHEN NEW.status IN ('paid', 'captured', 'completed') THEN 1 ELSE 0 END,
    payment_failure_count = payment_failure_count + CASE WHEN NEW.status IN ('failed', 'declined', 'cancelled', 'canceled', 'expired') THEN 1 ELSE 0 END,
    payment_integrity_failure_count = payment_integrity_failure_count + CASE WHEN NEW.integrityError IS NOT NULL THEN 1 ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_payment_delete AFTER DELETE ON payments BEGIN
  UPDATE admin_observability_summary SET payments_count = MAX(payments_count - 1, 0),
    payment_success_count = MAX(payment_success_count - CASE WHEN OLD.status IN ('paid', 'captured', 'completed') THEN 1 ELSE 0 END, 0),
    payment_failure_count = MAX(payment_failure_count - CASE WHEN OLD.status IN ('failed', 'declined', 'cancelled', 'canceled', 'expired') THEN 1 ELSE 0 END, 0),
    payment_integrity_failure_count = MAX(payment_integrity_failure_count - CASE WHEN OLD.integrityError IS NOT NULL THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_payment_integrity AFTER UPDATE OF integrityError ON payments BEGIN
  UPDATE admin_observability_summary SET
    payment_integrity_failure_count = MAX(payment_integrity_failure_count - CASE WHEN OLD.integrityError IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN NEW.integrityError IS NOT NULL THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_payment_status AFTER UPDATE OF status ON payments BEGIN
  UPDATE admin_observability_summary SET
    payment_success_count = MAX(payment_success_count - CASE WHEN OLD.status IN ('paid', 'captured', 'completed') THEN 1 ELSE 0 END + CASE WHEN NEW.status IN ('paid', 'captured', 'completed') THEN 1 ELSE 0 END, 0),
    payment_failure_count = MAX(payment_failure_count - CASE WHEN OLD.status IN ('failed', 'declined', 'cancelled', 'canceled', 'expired') THEN 1 ELSE 0 END + CASE WHEN NEW.status IN ('failed', 'declined', 'cancelled', 'canceled', 'expired') THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS admin_obs_connection_insert AFTER INSERT ON store_connections BEGIN
  UPDATE admin_observability_summary SET connections_count = connections_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_connection_delete AFTER DELETE ON store_connections BEGIN
  UPDATE admin_observability_summary SET connections_count = MAX(connections_count - 1, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS admin_obs_salla_insert AFTER INSERT ON salla_connections BEGIN
  UPDATE admin_observability_summary SET
    salla_connected_count = salla_connected_count + CASE WHEN NEW.status = 'connected' THEN 1 ELSE 0 END,
    salla_warning_count = salla_warning_count + CASE WHEN NEW.status <> 'connected' THEN 1 ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_salla_delete AFTER DELETE ON salla_connections BEGIN
  UPDATE admin_observability_summary SET
    salla_connected_count = MAX(salla_connected_count - CASE WHEN OLD.status = 'connected' THEN 1 ELSE 0 END, 0),
    salla_warning_count = MAX(salla_warning_count - CASE WHEN OLD.status <> 'connected' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_salla_status AFTER UPDATE OF status ON salla_connections BEGIN
  UPDATE admin_observability_summary SET
    salla_connected_count = MAX(salla_connected_count - CASE WHEN OLD.status = 'connected' THEN 1 ELSE 0 END + CASE WHEN NEW.status = 'connected' THEN 1 ELSE 0 END, 0),
    salla_warning_count = MAX(salla_warning_count - CASE WHEN OLD.status <> 'connected' THEN 1 ELSE 0 END + CASE WHEN NEW.status <> 'connected' THEN 1 ELSE 0 END, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TABLE IF NOT EXISTS admin_plan_summary (
  plan TEXT PRIMARY KEY,
  customers_count INTEGER NOT NULL DEFAULT 0,
  reports_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO admin_plan_summary (plan, customers_count, reports_count, updated_at)
SELECT p.plan,
  (SELECT COUNT(*) FROM users u WHERE COALESCE(NULLIF(u.plan, ''), 'free') = p.plan),
  (SELECT COUNT(*) FROM reports r JOIN users u ON u.id = r.userId
   WHERE COALESCE(NULLIF(u.plan, ''), 'free') = p.plan),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
  SELECT 'free' AS plan UNION ALL SELECT 'starter' UNION ALL SELECT 'growth'
  UNION ALL SELECT 'business' UNION ALL SELECT 'unknown'
) p
WHERE 1
ON CONFLICT(plan) DO UPDATE SET
  customers_count = excluded.customers_count,
  reports_count = excluded.reports_count,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS admin_obs_plan_user_insert AFTER INSERT ON users BEGIN
  INSERT INTO admin_plan_summary (plan, customers_count, updated_at)
  VALUES (COALESCE(NULLIF(NEW.plan, ''), 'free'), 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  ON CONFLICT(plan) DO UPDATE SET customers_count = customers_count + 1, updated_at = excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_plan_user_delete AFTER DELETE ON users BEGIN
  UPDATE admin_plan_summary SET customers_count = MAX(customers_count - 1, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE plan = COALESCE(NULLIF(OLD.plan, ''), 'free');
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_plan_user_move AFTER UPDATE OF plan ON users
WHEN COALESCE(NULLIF(OLD.plan, ''), 'free') <> COALESCE(NULLIF(NEW.plan, ''), 'free')
BEGIN
  UPDATE admin_plan_summary SET
    customers_count = MAX(customers_count - 1, 0),
    reports_count = MAX(reports_count - (SELECT COUNT(*) FROM reports WHERE userId = NEW.id), 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE plan = COALESCE(NULLIF(OLD.plan, ''), 'free');
  INSERT INTO admin_plan_summary (plan, customers_count, reports_count, updated_at)
  VALUES (
    COALESCE(NULLIF(NEW.plan, ''), 'free'), 1,
    (SELECT COUNT(*) FROM reports WHERE userId = NEW.id),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
  ON CONFLICT(plan) DO UPDATE SET
    customers_count = customers_count + 1,
    reports_count = reports_count + excluded.reports_count,
    updated_at = excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_plan_report_insert AFTER INSERT ON reports BEGIN
  INSERT INTO admin_plan_summary (plan, reports_count, updated_at)
  SELECT COALESCE(NULLIF(plan, ''), 'free'), 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM users WHERE id = NEW.userId
  ON CONFLICT(plan) DO UPDATE SET reports_count = reports_count + 1, updated_at = excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS admin_obs_plan_report_delete AFTER DELETE ON reports BEGIN
  UPDATE admin_plan_summary SET reports_count = MAX(reports_count - 1, 0),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE plan = COALESCE((SELECT NULLIF(plan, '') FROM users WHERE id = OLD.userId), 'free');
END;

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_salla_connections_updated_at ON salla_connections(updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_products_platform_updated_at ON products(platform, updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_platform_created_at ON orders(platform, createdAt DESC);
