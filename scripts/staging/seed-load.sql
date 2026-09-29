-- Synthetic staging-only tenants. Safe to rerun because all identifiers are deterministic.
INSERT OR IGNORE INTO users (id, email, plan, createdAt, email_verified, email_verified_at)
VALUES
  ('stage-small', 'small@staging.invalid', 'business', 1700000000000, 1, 1700000000000),
  ('stage-medium', 'medium@staging.invalid', 'business', 1700000000000, 1, 1700000000000),
  ('stage-large', 'large@staging.invalid', 'business', 1700000000000, 1, 1700000000000);

INSERT OR IGNORE INTO sessions (sessionId, userId, expiresAt, createdAt)
VALUES
  ('stage-small-session', 'stage-small', 4102444800000, 1700000000000),
  ('stage-medium-session', 'stage-medium', 4102444800000, 1700000000000),
  ('stage-large-session', 'stage-large', 4102444800000, 1700000000000);

INSERT OR IGNORE INTO store_connections (id, userId, platform, status, storeName, createdAt)
VALUES
  ('stage-conn-small', 'stage-small', 'csv', 'connected', 'Synthetic Small', 1700000000000),
  ('stage-conn-medium', 'stage-medium', 'csv', 'connected', 'Synthetic Medium', 1700000000000),
  ('stage-conn-large', 'stage-large', 'csv', 'connected', 'Synthetic Large', 1700000000000);

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 100)
INSERT OR IGNORE INTO products (id, userId, platform, externalId, title, sku, priceHalala, inventory, createdAt, updatedAt)
SELECT 'sp-' || x, 'stage-small', 'synthetic', 'sp-' || x, 'Small product ' || x, 'S-' || x, 1000 + x, x % 50, 1700000000000 + x, 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 5000)
INSERT OR IGNORE INTO products (id, userId, platform, externalId, title, sku, priceHalala, inventory, createdAt, updatedAt)
SELECT 'mp-' || x, 'stage-medium', 'synthetic', 'mp-' || x, 'Medium product ' || x, 'M-' || x, 1000 + (x % 9000), x % 100, 1700000000000 + x, 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 20000)
INSERT OR IGNORE INTO products (id, userId, platform, externalId, title, sku, priceHalala, inventory, createdAt, updatedAt)
SELECT 'lp-' || x, 'stage-large', 'synthetic', 'lp-' || x, 'Large product ' || x, 'L-' || x, 1000 + (x % 9000), x % 100, 1700000000000 + x, 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 1000)
INSERT OR IGNORE INTO orders (id, userId, platform, externalId, totalHalala, status, itemsCount, createdAt)
SELECT 'so-' || x, 'stage-small', 'synthetic', 'so-' || x, 5000 + (x % 50000), CASE WHEN x % 20 = 0 THEN 'ملغي' ELSE 'completed' END, 1 + (x % 5), 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 50000)
INSERT OR IGNORE INTO orders (id, userId, platform, externalId, totalHalala, status, itemsCount, createdAt)
SELECT 'mo-' || x, 'stage-medium', 'synthetic', 'mo-' || x, 5000 + (x % 50000), CASE WHEN x % 20 = 0 THEN 'ملغي' ELSE 'completed' END, 1 + (x % 5), 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 200000)
INSERT OR IGNORE INTO orders (id, userId, platform, externalId, totalHalala, status, itemsCount, createdAt)
SELECT 'lo-' || x, 'stage-large', 'synthetic', 'lo-' || x, 5000 + (x % 50000), CASE WHEN x % 20 = 0 THEN 'ملغي' ELSE 'completed' END, 1 + (x % 5), 1700000000000 + x FROM n;

INSERT OR IGNORE INTO reports (id, userId, storeId, reportJson, createdAt)
VALUES
  ('stage-report-small', 'stage-small', 'stage-conn-small', '{"synthetic":true}', 1700000000000),
  ('stage-report-medium', 'stage-medium', 'stage-conn-medium', '{"synthetic":true}', 1700000000000),
  ('stage-report-large', 'stage-large', 'stage-conn-large', '{"synthetic":true}', 1700000000000);

INSERT OR IGNORE INTO admin_accounts (id, email, password_hash, password_salt, password_iterations, role, created_at, updated_at)
VALUES ('stage-admin', 'admin@staging.invalid', 'unused', 'unused', 210000, 'super_admin', 1700000000000, 1700000000000);

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 5000)
INSERT OR IGNORE INTO payments (id, userId, provider, providerPaymentId, amountHalala, currency, planId, interval, status, createdAt)
SELECT 'stage-payment-' || x, CASE x % 3 WHEN 0 THEN 'stage-small' WHEN 1 THEN 'stage-medium' ELSE 'stage-large' END,
  'synthetic', 'stage-provider-' || x, 9900, 'SAR', 'business', 'monthly', 'captured', 1700000000000 + x FROM n;

WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 5000)
INSERT OR IGNORE INTO admin_audit_log (id, admin_id, action, target_type, target_id, metadata_json, created_at)
SELECT 'stage-audit-' || x, 'stage-admin', CASE WHEN x % 2 = 0 THEN 'read' ELSE 'test' END,
  'synthetic', CAST(x AS TEXT), '{}', 1700000000000 + x FROM n;
