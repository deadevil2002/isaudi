import { db, User, OTPCode, Session, DB_PATH } from './client';
import { randomUUID, randomBytes } from 'crypto';

export const dbService = {
  // User operations
  getUserByEmail: (email: string): User | undefined => {
    return db.prepare('SELECT *, free_reports_used as freeReportsUsed FROM users WHERE email = ?').get(email) as User | undefined;
  },

  createUser: (email: string): User => {
    const id = randomUUID();
    const now = Date.now();
    const user: User = {
      id,
      email,
      plan: 'free',
      planExpiresAt: null,
      createdAt: now,
      freeReportsUsed: 0
    };
    
    db.prepare(`
      INSERT INTO users (id, email, plan, planExpiresAt, createdAt, free_reports_used)
      VALUES (@id, @email, @plan, @planExpiresAt, @createdAt, @freeReportsUsed)
    `).run(user);
    
    return user;
  },

  // OTP operations
  createOTP: (email: string, codeHash: string): void => {
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    
    const otp: OTPCode = {
      email,
      codeHash,
      attempts: 0,
      expiresAt,
      createdAt: now
    };
    
    db.prepare(`
      INSERT OR REPLACE INTO otp_codes (email, codeHash, attempts, expiresAt, createdAt)
      VALUES (@email, @codeHash, @attempts, @expiresAt, @createdAt)
    `).run(otp);
  },

  getOTP: (email: string): OTPCode | undefined => {
    return db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(email) as OTPCode | undefined;
  },

  incrementOTPAttempts: (email: string): void => {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
  },
  
  deleteOTP: (email: string): void => {
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);
  },

  // Session operations
  createSession: (userId: string): Session => {
    const sessionId = randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days
    
    const session: Session = {
      sessionId,
      userId,
      expiresAt,
      createdAt: now
    };
    
    db.prepare(`
      INSERT INTO sessions (sessionId, userId, expiresAt, createdAt)
      VALUES (@sessionId, @userId, @expiresAt, @createdAt)
    `).run(session);
    
    return session;
  },
  
  getSession: (sessionId: string): Session | undefined => {
    const now = Date.now();
    // Clean expired sessions first (lazy cleanup)
    db.prepare('DELETE FROM sessions WHERE expiresAt < ?').run(now);
    
    return db.prepare('SELECT * FROM sessions WHERE sessionId = ? AND expiresAt > ?').get(sessionId, now) as Session | undefined;
  },
  
  deleteSession: (sessionId: string): void => {
    db.prepare('DELETE FROM sessions WHERE sessionId = ?').run(sessionId);
  },

  getUserById: (id: string): User | undefined => {
    return db.prepare('SELECT *, free_reports_used as freeReportsUsed FROM users WHERE id = ?').get(id) as User | undefined;
  },

  setEmailVerificationToken: (userId: string, token: string, expiresAt: number): void => {
    db.prepare(
      'UPDATE users SET email_verify_token = ?, email_verify_token_expires_at = ? WHERE id = ?'
    ).run(token, expiresAt, userId);
  },

  getUserByVerifyToken: (token: string): User | undefined => {
    return db
      .prepare(
        'SELECT *, free_reports_used as freeReportsUsed FROM users WHERE email_verify_token = ?'
      )
      .get(token) as User | undefined;
  },

  verifyEmailByToken: (token: string): { ok: boolean; userId?: string; reason?: string } => {
    const debugEmailVerify =
      process.env.NODE_ENV !== 'production' ||
      process.env.DEBUG_EMAIL_VERIFY === '1';

    const cleanToken = typeof token === 'string' ? token.trim() : '';
    const length = cleanToken.length;
    const head = length <= 4 ? cleanToken : cleanToken.slice(0, 4);
    const tail = length <= 8 ? cleanToken : cleanToken.slice(-4);
    const tokenSummary = {
      length,
      head,
      tail,
    };

    const countRow = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE email_verify_token = ?')
      .get(cleanToken) as { c?: number } | undefined;
    const countMatches = (countRow && typeof countRow.c === 'number' ? countRow.c : 0) || 0;

    const user = (dbService as any).getUserByVerifyToken(cleanToken) as User | undefined;

    if (!user) {
      if (debugEmailVerify) {
        console.log('[email-verify] invalid token', {
          token: tokenSummary,
          countMatches,
          dbPath: DB_PATH,
          reason: 'no_user_for_token',
        });
      }
      return { ok: false, reason: 'invalid' };
    }

    const now = Date.now();
    const expiresAt = (user as any).email_verify_token_expires_at as number | null | undefined;

    if (!expiresAt || expiresAt < now) {
      if (debugEmailVerify) {
        console.log('[email-verify] expired token', {
          token: tokenSummary,
          userId: user.id,
          expiresAt,
          now,
          dbPath: DB_PATH,
        });
      }
      return { ok: false, reason: 'expired' };
    }

    db.prepare(
      'UPDATE users SET email_verified = 1, email_verified_at = ?, email_verify_token = NULL, email_verify_token_expires_at = NULL WHERE id = ?'
    ).run(now, user.id);

    if (debugEmailVerify) {
      console.log('[email-verify] success', {
        token: tokenSummary,
        userId: user.id,
        dbPath: DB_PATH,
      });
    }

    return { ok: true, userId: user.id };
  },

  updateUserPlan: (userId: string, plan: string, expiresAt: number): void => {
    db.prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?').run(plan, expiresAt, userId);
  },

  setUserPlanDev: (userId: string, plan: string): void => {
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
  },

  // Payment & Subscription operations
  createPayment: (payment: any): void => {
    db.prepare(`
      INSERT INTO payments (id, userId, provider, providerPaymentId, amountHalala, currency, status, createdAt, rawJson)
      VALUES (@id, @userId, @provider, @providerPaymentId, @amountHalala, @currency, @status, @createdAt, @rawJson)
    `).run(payment);
  },

  createSubscription: (subscription: any): void => {
    db.prepare(`
      INSERT INTO subscriptions (id, userId, planId, interval, status, startedAt, expiresAt, createdAt)
      VALUES (@id, @userId, @planId, @interval, @status, @startedAt, @expiresAt, @createdAt)
    `).run(subscription);
  },

  getSubscriptionByUserId: (userId: string): any => {
    return db.prepare('SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
  },

  // Store & Data operations
  getStoreConnection: (userId: string): any => {
    return db.prepare("SELECT * FROM store_connections WHERE userId = ? AND status = 'connected'").get(userId);
  },

  createOrUpdateStoreConnection: (conn: any): void => {
    const existing = db.prepare('SELECT id FROM store_connections WHERE userId = ? AND platform = ?').get(conn.userId, conn.platform) as any;
    
    if (existing) {
      db.prepare(`
        UPDATE store_connections 
        SET status = @status, storeName = @storeName, storeUrl = @storeUrl, 
            accessTokenEncrypted = @accessTokenEncrypted, refreshTokenEncrypted = @refreshTokenEncrypted, 
            tokenExpiresAt = @tokenExpiresAt
        WHERE id = @id
      `).run({ ...conn, id: existing.id });
    } else {
      db.prepare(`
        INSERT INTO store_connections (id, userId, platform, status, storeName, storeUrl, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, createdAt)
        VALUES (@id, @userId, @platform, @status, @storeName, @storeUrl, @accessTokenEncrypted, @refreshTokenEncrypted, @tokenExpiresAt, @createdAt)
      `).run(conn);
    }
  },

  disconnectStore: (userId: string): void => {
    db.prepare("UPDATE store_connections SET status = 'disconnected' WHERE userId = ?").run(userId);
  },

  upsertProduct: (product: any): void => {
    const existing = db.prepare('SELECT id FROM products WHERE userId = ? AND externalId = ?').get(product.userId, product.externalId) as any;
    
    if (existing) {
      db.prepare(`
        UPDATE products 
        SET title = @title, sku = @sku, priceHalala = @priceHalala, 
            inventory = @inventory, category = @category, updatedAt = @updatedAt,
            reportId = @reportId
        WHERE id = @id
      `).run({ ...product, id: existing.id });
    } else {
      db.prepare(`
        INSERT INTO products (id, userId, platform, externalId, title, sku, priceHalala, inventory, category, reportId, createdAt, updatedAt)
        VALUES (@id, @userId, @platform, @externalId, @title, @sku, @priceHalala, @inventory, @category, @reportId, @createdAt, @updatedAt)
      `).run(product);
    }
  },
  
  getProductByExternalId: (userId: string, externalId: string): any | null => {
    return db.prepare(`
      SELECT * FROM products 
      WHERE userId = ? AND externalId = ?
      ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
      LIMIT 1
    `).get(userId, externalId) || null;
  },

  // Product Costs
  getProductCost: (productId: string): any | null => {
    return db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(productId) || null;
  },

  upsertProductCost: (productId: string, payload: Partial<{
    purchase_cost_halala: number;
    labor_cost_halala: number;
    shipping_cost_halala: number;
    packaging_cost_halala: number;
    ads_cost_per_unit_halala: number;
    payment_fee_percent_bps: number;
  }>): void => {
    const now = Date.now();
    const existing = db.prepare('SELECT id, created_at FROM product_costs WHERE product_id = ?').get(productId) as any;
    const defaults = {
      purchase_cost_halala: 0,
      labor_cost_halala: 0,
      shipping_cost_halala: 0,
      packaging_cost_halala: 0,
      ads_cost_per_unit_halala: 0,
      payment_fee_percent_bps: 0
    };
    const data = { ...defaults, ...payload };

    if (existing) {
      db.prepare(`
        UPDATE product_costs
        SET purchase_cost_halala = @purchase_cost_halala,
            labor_cost_halala = @labor_cost_halala,
            shipping_cost_halala = @shipping_cost_halala,
            packaging_cost_halala = @packaging_cost_halala,
            ads_cost_per_unit_halala = @ads_cost_per_unit_halala,
            payment_fee_percent_bps = @payment_fee_percent_bps,
            is_configured = 1,
            updated_at = @updated_at
        WHERE product_id = @product_id
      `).run({
        ...data,
        product_id: productId,
        updated_at: now
      });
    } else {
      db.prepare(`
        INSERT INTO product_costs (
          id, product_id,
          purchase_cost_halala, labor_cost_halala, shipping_cost_halala, packaging_cost_halala,
          ads_cost_per_unit_halala, payment_fee_percent_bps,
          is_configured,
          created_at, updated_at
        ) VALUES (
          @id, @product_id,
          @purchase_cost_halala, @labor_cost_halala, @shipping_cost_halala, @packaging_cost_halala,
          @ads_cost_per_unit_halala, @payment_fee_percent_bps,
          @is_configured,
          @created_at, @updated_at
        )
      `).run({
        id: randomUUID(),
        product_id: productId,
        ...data,
        is_configured: 1,
        created_at: now,
        updated_at: now
      });
    }
  },

  addOrder: (order: any): void => {
    // Insert order tied to a report; allow duplicates across reports
    db.prepare(`
      INSERT INTO orders (id, userId, platform, externalId, reportId, totalHalala, status, itemsCount, createdAt)
      VALUES (@id, @userId, @platform, @externalId, @reportId, @totalHalala, @status, @itemsCount, @createdAt)
    `).run(order);
  },

  insertOrderItem: (item: {
    id: string;
    report_id: string;
    order_id: string;
    sku: string | null;
    product_name: string | null;
    qty: number;
    allocated_revenue: number;
    created_at: number;
  }): void => {
    db.prepare(`
      INSERT INTO order_items (id, report_id, order_id, sku, product_name, qty, allocated_revenue, created_at)
      VALUES (@id, @report_id, @order_id, @sku, @product_name, @qty, @allocated_revenue, @created_at)
    `).run(item);
  },

  // Backward-compatible upsert for older callers
  upsertOrder: (order: any): void => {
    const existing = db.prepare('SELECT id FROM orders WHERE userId = ? AND externalId = ?').get(order.userId, order.externalId) as any;
    if (existing) {
      db.prepare(`
        UPDATE orders 
        SET totalHalala = @totalHalala, status = @status, itemsCount = @itemsCount, reportId = COALESCE(@reportId, reportId)
        WHERE id = @id
      `).run({ ...order, id: existing.id });
    } else {
      db.prepare(`
        INSERT INTO orders (id, userId, platform, externalId, reportId, totalHalala, status, itemsCount, createdAt)
        VALUES (@id, @userId, @platform, @externalId, @reportId, @totalHalala, @status, @itemsCount, @createdAt)
      `).run(order);
    }
  },

  getStoreStats: (userId: string): any => {
    const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE userId = ?').get(userId) as any;
    const notCounted = ['ملغي', 'محذوف', 'ملغى'];
    const filtered = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum
      FROM orders
      WHERE userId = ? AND COALESCE(status,'') NOT IN (${notCounted.map(() => '?').join(',')})
    `).get(userId, ...notCounted) as any;
    const excluded = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum
      FROM orders
      WHERE userId = ? AND COALESCE(status,'') IN (${notCounted.map(() => '?').join(',')})
    `).get(userId, ...notCounted) as any;
    const totalOrders = filtered.cnt || 0;
    const totalSalesHalala = filtered.sum || 0;
    const avgOrderValue = totalOrders > 0 ? Math.round((totalSalesHalala / totalOrders)) : 0;
    return {
      products: productsCount.count || 0,
      orders: totalOrders,
      sales: totalSalesHalala,
      avgOrderValueHalala: avgOrderValue,
      excludedOrdersCount: excluded.cnt || 0,
      excludedSalesHalala: excluded.sum || 0
    };
  },

  // Costs identity helpers
  listDistinctProductsForUser: (userId: string): Array<{
    identityKey: string;
    sku: string | null;
    externalId: string | null;
    name: string;
    latestPriceHalala: number | null;
    productIds: string[];
  }> => {
    const rows = db.prepare(`
      SELECT id, sku, externalId, title, priceHalala, createdAt, updatedAt
      FROM products
      WHERE userId = ?
      ORDER BY COALESCE(updatedAt, 0) DESC, COALESCE(createdAt, 0) DESC
    `).all(userId) as any[];

    const normalizeName = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const map = new Map<string, {
      identityKey: string;
      sku: string | null;
      externalId: string | null;
      name: string;
      latestPriceHalala: number | null;
      productIds: string[];
    }>();

    for (const r of rows) {
      const sku = (r.sku || '').trim();
      const ext = (r.externalId || '').trim();
      const name = normalizeName(r.title || '');
      let key: string;
      if (sku) key = `sku:${sku}`;
      else if (ext) key = `ext:${ext}`;
      else key = `name:${name.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          identityKey: key,
          sku: sku || null,
          externalId: ext || null,
          name: name || '(بدون اسم)',
          latestPriceHalala: r.priceHalala ?? null,
          productIds: [r.id]
        });
      } else {
        const g = map.get(key)!;
        g.productIds.push(r.id);
        if (g.latestPriceHalala == null && r.priceHalala != null) {
          g.latestPriceHalala = r.priceHalala;
        }
        if (!g.sku && sku) g.sku = sku;
        if (!g.externalId && ext) g.externalId = ext;
        if (!g.name && name) g.name = name;
      }
    }

    return Array.from(map.values());
  },

  getCostsByIdentity: (identityKey: string, userId: string): any => {
    const resolve = (): string | null => {
      const [prefix, ...rest] = identityKey.split(':');
      const value = rest.join(':').trim();
      if (!value) return null;
      if (prefix === 'sku') {
        const r = db.prepare(`
          SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
        `).get(userId, value) as any;
        return r?.id || null;
      } else if (prefix === 'ext') {
        const r = db.prepare(`
          SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(externalId,'')) = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
        `).get(userId, value) as any;
        return r?.id || null;
      } else if (prefix === 'name') {
        const rows = db.prepare(`
          SELECT id, title FROM products WHERE userId = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        `).all(userId) as any[];
        const normalized = (value || '').toLowerCase();
        for (const row of rows) {
          const name = (row.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (name === normalized) return row.id;
        }
      }
      return null;
    };
    const productId = resolve();
    if (!productId) {
      return {
        is_configured: 0,
        purchase_cost_halala: 0,
        labor_cost_halala: 0,
        shipping_cost_halala: 0,
        packaging_cost_halala: 0,
        ads_cost_per_unit_halala: 0,
        payment_fee_percent_bps: 0
      };
    }
    const cost = db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(productId) as any;
    if (!cost) {
      return {
        is_configured: 0,
        purchase_cost_halala: 0,
        labor_cost_halala: 0,
        shipping_cost_halala: 0,
        packaging_cost_halala: 0,
        ads_cost_per_unit_halala: 0,
        payment_fee_percent_bps: 0
      };
    }
    return {
      is_configured: cost.is_configured || 0,
      purchase_cost_halala: cost.purchase_cost_halala,
      labor_cost_halala: cost.labor_cost_halala,
      shipping_cost_halala: cost.shipping_cost_halala,
      packaging_cost_halala: cost.packaging_cost_halala,
      ads_cost_per_unit_halala: cost.ads_cost_per_unit_halala,
      payment_fee_percent_bps: cost.payment_fee_percent_bps
    };
  },

  upsertCostsByIdentity: (identityKey: string, userId: string, payload: {
    purchase_cost_halala?: number;
    labor_cost_halala?: number;
    shipping_cost_halala?: number;
    packaging_cost_halala?: number;
    ads_cost_per_unit_halala?: number;
    payment_fee_percent_bps?: number;
  }): void => {
    const [prefix, ...rest] = identityKey.split(':');
    const value = rest.join(':').trim();
    let productId: string | null = null;
    if (prefix === 'sku') {
      const r = db.prepare(`
        SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
      `).get(userId, value) as any;
      productId = r?.id || null;
    } else if (prefix === 'ext') {
      const r = db.prepare(`
        SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(externalId,'')) = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
      `).get(userId, value) as any;
      productId = r?.id || null;
    } else if (prefix === 'name') {
      const rows = db.prepare(`
        SELECT id, title FROM products WHERE userId = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
      `).all(userId) as any[];
      const normalized = (value || '').toLowerCase();
      for (const row of rows) {
        const name = (row.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (name === normalized) { productId = row.id; break; }
      }
    }
    if (!productId) throw new Error('Product not found for identity');
    (exports as any).dbService.upsertProductCost(productId, payload);
  },

  // Report operations
  saveReport: (report: any): void => {
    db.prepare(`
      INSERT INTO reports (id, userId, storeId, reportJson, createdAt)
      VALUES (@id, @userId, @storeId, @reportJson, @createdAt)
    `).run(report);
  },

  createEmptyReport: (id: string, userId: string, storeId?: string): void => {
    db.prepare(`
      INSERT INTO reports (id, userId, storeId, reportJson, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, storeId || null, JSON.stringify({ status: 'pending' }), Date.now());
  },

  updateReportJson: (id: string, reportJson: string): void => {
    db.prepare(`UPDATE reports SET reportJson = ? WHERE id = ?`).run(reportJson, id);
  },

  getReportById: (id: string): any => {
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  },

  listReportsByUser: (userId: string): any[] => {
    return db.prepare('SELECT * FROM reports WHERE userId = ? ORDER BY createdAt DESC').all(userId) as any[];
  },

  getLatestReport: (userId: string): any => {
    return db.prepare('SELECT * FROM reports WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
  },

  incrementFreeReports: (userId: string): void => {
    db.prepare('UPDATE users SET free_reports_used = COALESCE(free_reports_used, 0) + 1 WHERE id = ?').run(userId);
  },

  // Report snapshots
  getSnapshotByHash: (userId: string, sourceHash: string): any | null => {
    return db.prepare(`
      SELECT * FROM report_snapshots 
      WHERE user_id = ? AND source_hash = ?
      LIMIT 1
    `).get(userId, sourceHash) || null;
  },
  insertSnapshot: (row: any): void => {
    db.prepare(`
      INSERT INTO report_snapshots (
        id, user_id, created_at, source_hash, time_range_start, time_range_end,
        report_id, gross_sales_halala, orders_count, total_profit_halala,
        margin_pct_x100, missing_cost_products_count, missing_cost_sales_halala, report_json
      ) VALUES (
        @id, @user_id, @created_at, @source_hash, @time_range_start, @time_range_end,
        @report_id, @gross_sales_halala, @orders_count, @total_profit_halala,
        @margin_pct_x100, @missing_cost_products_count, @missing_cost_sales_halala, @report_json
      )
    `).run(row);
  },
  listSnapshots: (userId: string, limit: number = 12): any[] => {
    return db.prepare(`
      SELECT * FROM report_snapshots
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];
  },
  getSnapshotById: (userId: string, id: string): any | null => {
    return db.prepare(`
      SELECT * FROM report_snapshots WHERE user_id = ? AND id = ?
    `).get(userId, id) || null;
  },
  getPreviousSnapshot: (userId: string, timeRangeStart: number): any | null => {
    return db.prepare(`
      SELECT * FROM report_snapshots 
      WHERE user_id = ? AND time_range_end < ?
      ORDER BY time_range_end DESC
      LIMIT 1
    `).get(userId, timeRangeStart) || null;
  }
};
