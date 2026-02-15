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

CREATE TABLE IF NOT EXISTS sessions (
  sessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES users(id)
);

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
  providerPaymentId TEXT,
  amountHalala INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  rawJson TEXT
);

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

