import { join } from 'path';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import type { Database as SqliteDatabase } from 'better-sqlite3';

const DB_PATH =
  process.env.DB_PATH && process.env.DB_PATH.trim().length > 0
    ? process.env.DB_PATH.trim()
    : join(process.cwd(), 'local.db');

let sqliteDb: SqliteDatabase | null = null;

function isCloudflareRuntime(): boolean {
  return Boolean((globalThis as any).Cloudflare) || process.env.NEXT_RUNTIME === 'edge';
}

function getD1FromContext(): any | null {
  try {
    const ctx = getCloudflareContext();
    return (ctx as any)?.env?.DB ?? (ctx as any)?.context?.env?.DB ?? null;
  } catch {
    return null;
  }
}

function waitFor<T>(promise: Promise<T>): T {
  if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
    throw new Error('Async wait is not supported in this runtime');
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  let result: T | undefined;
  let error: any;
  promise
    .then((value) => {
      result = value;
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    })
    .catch((err) => {
      error = err;
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    });
  while (Atomics.load(view, 0) === 0) {
    Atomics.wait(view, 0, 0, 50);
  }
  if (error) throw error;
  return result as T;
}

function createD1Adapter(d1: any): SqliteDatabase {
  return {
    prepare(sql: string) {
      return {
        get: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).first());
        },
        all: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).all());
        },
        run: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).run());
        },
      };
    },
  } as unknown as SqliteDatabase;
}

function getRequire(): NodeRequire | null {
  try {
    return eval('require') as NodeRequire;
  } catch {
    return null;
  }
}

function initializeSqlite(db: SqliteDatabase): void {
  try {
    console.log('[db] path', DB_PATH);
    const usersSchema = db.prepare('PRAGMA table_info(users)').all();
    console.log('[db] users schema', usersSchema);
  } catch (e) {
    console.error('[db] schema inspection error', e);
  }

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      planExpiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at INTEGER,
      email_verify_token TEXT,
      email_verify_token_expires_at INTEGER
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
      platform TEXT NOT NULL, -- 'salla' or 'csv'
      status TEXT NOT NULL, -- 'connected' or 'disconnected'
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

    -- Product costs (persistent, per product)
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

    -- Add reportId to products if schema doesn't include it (ignored if exists)
  `);

  // Migration: Add free_reports_used to users if not exists
  try {
    db.exec('ALTER TABLE users ADD COLUMN free_reports_used INTEGER DEFAULT 0');
  } catch (e: any) {
    // Column likely already exists
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error:', e);
    }
  }

  // Migration: Add email verification columns to users if not exists
  try {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (users.email_verified):', e);
    }
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (users.email_verified_at):', e);
    }
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN email_verify_token TEXT');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (users.email_verify_token):', e);
    }
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN email_verify_token_expires_at INTEGER');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (users.email_verify_token_expires_at):', e);
    }
  }

  // Migration: Add reportId to products if not exists
  try {
    db.exec('ALTER TABLE products ADD COLUMN reportId TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_products_report ON products(reportId)');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (products.reportId):', e);
    }
  }

  // Migration: Add reportId index to orders if not exists (column added above in main DDL; if pre-existing DB, attempt add)
  try {
    // Ensure column exists in legacy DBs
    db.exec('ALTER TABLE orders ADD COLUMN reportId TEXT');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (orders.reportId add):', e);
    }
  }
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_orders_report ON orders(reportId)');
  } catch (e: any) {
    console.error('Migration error (orders.reportId index):', e);
  }

  // Migration: Add is_configured to product_costs if not exists
  try {
    db.exec('ALTER TABLE product_costs ADD COLUMN is_configured INTEGER NOT NULL DEFAULT 0');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (product_costs.is_configured):', e);
    }
  }

  // Report snapshots (weekly)
  try {
    db.exec(`
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
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_created_at ON report_snapshots(user_id, created_at DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_timerange ON report_snapshots(user_id, time_range_start, time_range_end)');
  } catch (e: any) {
    console.error('Migration error (report_snapshots):', e);
  }
}

export function getSqliteDb(): SqliteDatabase {
  if (sqliteDb) return sqliteDb;

  if (isCloudflareRuntime()) {
    const d1 = getD1FromContext();
    if (d1) {
      return createD1Adapter(d1);
    }
    throw new Error('SQLite is not available in Cloudflare runtime');
  }

  const req = getRequire();
  if (!req) {
    throw new Error('SQLite require is not available in this runtime');
  }

  const Database = req('better-sqlite3') as typeof import('better-sqlite3');
  sqliteDb = new Database(DB_PATH);

  try {
    initializeSqlite(sqliteDb);
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  return sqliteDb;
}

export const db = new Proxy({} as SqliteDatabase, {
  get(_target, prop) {
    return (getSqliteDb() as any)[prop];
  },
});

export { DB_PATH };

export interface User {
  id: string;
  email: string;
  plan: string;
  planExpiresAt: number | null;
  createdAt: number;
  freeReportsUsed?: number;
  email_verified?: number;
  email_verified_at?: number | null;
  email_verify_token?: string | null;
  email_verify_token_expires_at?: number | null;
}

export interface Report {
  id: string;
  userId: string;
  storeId?: string;
  reportJson: string;
  createdAt: number;
}

export interface OTPCode {
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  createdAt: number;
}

export interface Session {
  sessionId: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  interval: 'month' | 'year';
  status: 'active' | 'expired' | 'pending' | 'canceled';
  startedAt: number;
  expiresAt: number;
  createdAt: number;
}

export interface Payment {
  id: string;
  userId: string;
  provider: string;
  providerPaymentId: string | null;
  amountHalala: number;
  currency: string;
  status: string;
  createdAt: number;
  rawJson?: string;
}

export interface StoreConnection {
  id: string;
  userId: string;
  platform: 'salla' | 'csv';
  status: 'connected' | 'disconnected';
  storeName?: string;
  storeUrl?: string;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  tokenExpiresAt?: number;
  createdAt: number;
}

export interface Product {
  id: string;
  userId: string;
  platform: string;
  externalId?: string;
  title: string;
  sku: string;
  priceHalala: number;
  inventory: number;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string;
  userId: string;
  platform: string;
  externalId?: string;
  totalHalala: number;
  status: string;
  itemsCount: number;
  createdAt: number;
}
