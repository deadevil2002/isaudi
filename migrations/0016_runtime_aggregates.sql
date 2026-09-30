-- Exact, persistent hot-path aggregates. The initial SELECTs are a one-time backfill;
-- triggers keep both rows authoritative after the migration completes.
CREATE TABLE IF NOT EXISTS user_runtime_summaries (
  user_id TEXT PRIMARY KEY,
  products_count INTEGER NOT NULL DEFAULT 0 CHECK (products_count >= 0),
  orders_count INTEGER NOT NULL DEFAULT 0 CHECK (orders_count >= 0),
  sales_halala INTEGER NOT NULL DEFAULT 0,
  excluded_orders_count INTEGER NOT NULL DEFAULT 0 CHECK (excluded_orders_count >= 0),
  excluded_sales_halala INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_runtime_summaries (
  user_id, products_count, orders_count, sales_halala,
  excluded_orders_count, excluded_sales_halala, updated_at
)
SELECT
  u.id,
  (SELECT COUNT(*) FROM products p WHERE p.userId = u.id),
  (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى')),
  (SELECT COALESCE(SUM(o.totalHalala), 0) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى')),
  (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') IN ('ملغي', 'محذوف', 'ملغى')),
  (SELECT COALESCE(SUM(o.totalHalala), 0) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') IN ('ملغي', 'محذوف', 'ملغى')),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM users u
WHERE 1
ON CONFLICT(user_id) DO UPDATE SET
  products_count = excluded.products_count,
  orders_count = excluded.orders_count,
  sales_halala = excluded.sales_halala,
  excluded_orders_count = excluded.excluded_orders_count,
  excluded_sales_halala = excluded.excluded_sales_halala,
  updated_at = excluded.updated_at;

CREATE TABLE IF NOT EXISTS runtime_admin_summary (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  users_count INTEGER NOT NULL DEFAULT 0 CHECK (users_count >= 0),
  active_subscriptions_count INTEGER NOT NULL DEFAULT 0 CHECK (active_subscriptions_count >= 0),
  captured_revenue_halala INTEGER NOT NULL DEFAULT 0,
  reports_count INTEGER NOT NULL DEFAULT 0 CHECK (reports_count >= 0),
  updated_at INTEGER NOT NULL
);

INSERT INTO runtime_admin_summary (
  id, users_count, active_subscriptions_count, captured_revenue_halala, reports_count, updated_at
)
SELECT
  1,
  (SELECT COUNT(*) FROM users),
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
  (SELECT COALESCE(SUM(amountHalala), 0) FROM payments WHERE status IN ('paid', 'captured', 'completed')),
  (SELECT COUNT(*) FROM reports),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
ON CONFLICT(id) DO UPDATE SET
  users_count = excluded.users_count,
  active_subscriptions_count = excluded.active_subscriptions_count,
  captured_revenue_halala = excluded.captured_revenue_halala,
  reports_count = excluded.reports_count,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_user_insert
AFTER INSERT ON users BEGIN
  INSERT OR IGNORE INTO user_runtime_summaries (user_id, updated_at)
  VALUES (NEW.id, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
  UPDATE runtime_admin_summary SET users_count = users_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_user_delete
AFTER DELETE ON users BEGIN
  DELETE FROM user_runtime_summaries WHERE user_id = OLD.id;
  UPDATE runtime_admin_summary SET users_count = users_count - 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_product_insert
AFTER INSERT ON products BEGIN
  INSERT INTO user_runtime_summaries (user_id, products_count, updated_at)
  VALUES (NEW.userId, 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  ON CONFLICT(user_id) DO UPDATE SET products_count = products_count + 1, updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_product_delete
AFTER DELETE ON products BEGIN
  UPDATE user_runtime_summaries SET products_count = products_count - 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE user_id = OLD.userId;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_product_move
AFTER UPDATE OF userId ON products WHEN OLD.userId IS NOT NEW.userId BEGIN
  UPDATE user_runtime_summaries SET products_count = products_count - 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE user_id = OLD.userId;
  INSERT INTO user_runtime_summaries (user_id, products_count, updated_at)
  VALUES (NEW.userId, 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  ON CONFLICT(user_id) DO UPDATE SET products_count = products_count + 1, updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_order_insert
AFTER INSERT ON orders BEGIN
  INSERT INTO user_runtime_summaries (
    user_id, orders_count, sales_halala, excluded_orders_count, excluded_sales_halala, updated_at
  ) VALUES (
    NEW.userId,
    CASE WHEN COALESCE(NEW.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(NEW.totalHalala, 0) ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(NEW.totalHalala, 0) ELSE 0 END,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  ) ON CONFLICT(user_id) DO UPDATE SET
    orders_count = orders_count + excluded.orders_count,
    sales_halala = sales_halala + excluded.sales_halala,
    excluded_orders_count = excluded_orders_count + excluded.excluded_orders_count,
    excluded_sales_halala = excluded_sales_halala + excluded.excluded_sales_halala,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_order_delete
AFTER DELETE ON orders BEGIN
  UPDATE user_runtime_summaries SET
    orders_count = orders_count - CASE WHEN COALESCE(OLD.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    sales_halala = sales_halala - CASE WHEN COALESCE(OLD.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(OLD.totalHalala, 0) ELSE 0 END,
    excluded_orders_count = excluded_orders_count - CASE WHEN COALESCE(OLD.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    excluded_sales_halala = excluded_sales_halala - CASE WHEN COALESCE(OLD.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(OLD.totalHalala, 0) ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE user_id = OLD.userId;
END;

CREATE TRIGGER IF NOT EXISTS runtime_user_summary_order_update
AFTER UPDATE OF userId, status, totalHalala ON orders BEGIN
  UPDATE user_runtime_summaries SET
    orders_count = orders_count - CASE WHEN COALESCE(OLD.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    sales_halala = sales_halala - CASE WHEN COALESCE(OLD.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(OLD.totalHalala, 0) ELSE 0 END,
    excluded_orders_count = excluded_orders_count - CASE WHEN COALESCE(OLD.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    excluded_sales_halala = excluded_sales_halala - CASE WHEN COALESCE(OLD.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(OLD.totalHalala, 0) ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE user_id = OLD.userId;
  INSERT INTO user_runtime_summaries (
    user_id, orders_count, sales_halala, excluded_orders_count, excluded_sales_halala, updated_at
  ) VALUES (
    NEW.userId,
    CASE WHEN COALESCE(NEW.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(NEW.totalHalala, 0) ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN 1 ELSE 0 END,
    CASE WHEN COALESCE(NEW.status, '') IN ('ملغي', 'محذوف', 'ملغى') THEN COALESCE(NEW.totalHalala, 0) ELSE 0 END,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  ) ON CONFLICT(user_id) DO UPDATE SET
    orders_count = orders_count + excluded.orders_count,
    sales_halala = sales_halala + excluded.sales_halala,
    excluded_orders_count = excluded_orders_count + excluded.excluded_orders_count,
    excluded_sales_halala = excluded_sales_halala + excluded.excluded_sales_halala,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS runtime_admin_subscription_insert
AFTER INSERT ON subscriptions WHEN NEW.status = 'active' BEGIN
  UPDATE runtime_admin_summary SET active_subscriptions_count = active_subscriptions_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS runtime_admin_subscription_delete
AFTER DELETE ON subscriptions WHEN OLD.status = 'active' BEGIN
  UPDATE runtime_admin_summary SET active_subscriptions_count = active_subscriptions_count - 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS runtime_admin_subscription_update
AFTER UPDATE OF status ON subscriptions BEGIN
  UPDATE runtime_admin_summary SET active_subscriptions_count = active_subscriptions_count
    - CASE WHEN OLD.status = 'active' THEN 1 ELSE 0 END
    + CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS runtime_admin_payment_insert
AFTER INSERT ON payments WHEN NEW.status IN ('paid', 'captured', 'completed') BEGIN
  UPDATE runtime_admin_summary SET captured_revenue_halala = captured_revenue_halala + COALESCE(NEW.amountHalala, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS runtime_admin_payment_delete
AFTER DELETE ON payments WHEN OLD.status IN ('paid', 'captured', 'completed') BEGIN
  UPDATE runtime_admin_summary SET captured_revenue_halala = captured_revenue_halala - COALESCE(OLD.amountHalala, 0), updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS runtime_admin_payment_update
AFTER UPDATE OF status, amountHalala ON payments BEGIN
  UPDATE runtime_admin_summary SET captured_revenue_halala = captured_revenue_halala
    - CASE WHEN OLD.status IN ('paid', 'captured', 'completed') THEN COALESCE(OLD.amountHalala, 0) ELSE 0 END
    + CASE WHEN NEW.status IN ('paid', 'captured', 'completed') THEN COALESCE(NEW.amountHalala, 0) ELSE 0 END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS runtime_admin_report_insert
AFTER INSERT ON reports BEGIN
  UPDATE runtime_admin_summary SET reports_count = reports_count + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS runtime_admin_report_delete
AFTER DELETE ON reports BEGIN
  UPDATE runtime_admin_summary SET reports_count = reports_count - 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE id = 1;
END;
