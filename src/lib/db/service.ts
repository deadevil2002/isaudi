import { getDb, User, OTPChallenge, Session, DB_PATH } from './client';
import { randomUUID, randomBytes } from 'crypto';
import { limiterDigest, OTP_LIMITS, OTP_WINDOW_MS } from '@/lib/auth/otp';

export const dbService = {
  // User operations
  getUserByEmail: async (email: string): Promise<User | undefined> => {
    const db = await getDb();
    return db.prepare('SELECT *, free_reports_used as freeReportsUsed FROM users WHERE email = ?').get(email) as User | undefined;
  },

  createUser: async (email: string): Promise<User> => {
    const db = await getDb();
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
  createOTP: async (email: string, codeHash: string): Promise<void> => {
    const db = await getDb();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    
    const otp: OTPChallenge = {
      email,
      otp_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
      created_at: now
    };
    
    db.prepare(`
      INSERT OR REPLACE INTO otp_challenges (email, otp_hash, attempts, expires_at, created_at, consumed_at)
      VALUES (@email, @otp_hash, @attempts, @expires_at, @created_at, NULL)
    `).run(otp);
  },

  getOTP: async (email: string): Promise<OTPChallenge | undefined> => {
    const db = await getDb();
    return db.prepare('SELECT * FROM otp_challenges WHERE email = ?').get(email) as OTPChallenge | undefined;
  },

  incrementOTPAttempts: async (email: string): Promise<void> => {
    const db = await getDb();
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE email = ?').run(email);
  },
  
  deleteOTP: async (email: string): Promise<void> => {
    const db = await getDb();
    db.prepare('DELETE FROM otp_challenges WHERE email = ?').run(email);
  },

  consumeOTP: async (email: string, otpHash: string, now: number): Promise<boolean> => {
    const db = await getDb();
    const row = await db
      .prepare(`
        DELETE FROM otp_challenges
        WHERE email = ?
          AND otp_hash = ?
          AND attempts < ?
          AND consumed_at IS NULL
          AND expires_at > ?
        RETURNING email
      `)
      .get(email, otpHash, OTP_LIMITS.verifyEmail, now);
    return Boolean(row);
  },

  consumeRateLimit: async (key: string, limit: number, now = Date.now()): Promise<{ allowed: boolean; retryAfter: number }> => {
    const db = await getDb();
    const windowStart = Math.floor(now / OTP_WINDOW_MS) * OTP_WINDOW_MS;
    const keyHash = limiterDigest(key);
    const row = db.prepare(`INSERT INTO otp_rate_limits (key_hash, window_start, expires_at, count)
      VALUES (?, ?, ?, 1) ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1
      WHERE count < ? RETURNING count`).get(keyHash, windowStart, windowStart + OTP_WINDOW_MS, limit) as any;
    return row ? { allowed: true, retryAfter: 0 } : { allowed: false, retryAfter: Math.max(1, Math.ceil((windowStart + OTP_WINDOW_MS - now) / 1000)) };
  },

  checkRateLimit: async (key: string, limit: number, now = Date.now()): Promise<{ allowed: boolean; retryAfter: number }> => {
    const db = await getDb();
    const windowStart = Math.floor(now / OTP_WINDOW_MS) * OTP_WINDOW_MS;
    const keyHash = limiterDigest(key);
    const row = db.prepare('SELECT count FROM otp_rate_limits WHERE key_hash = ? AND window_start = ?').get(keyHash, windowStart) as any;
    return Number(row?.count || 0) < limit ? { allowed: true, retryAfter: 0 } : { allowed: false, retryAfter: Math.max(1, Math.ceil((windowStart + OTP_WINDOW_MS - now) / 1000)) };
  },

  // Session operations
  createSession: async (userId: string): Promise<Session> => {
    const db = await getDb();
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
  
  getSession: async (sessionId: string): Promise<Session | undefined> => {
    const db = await getDb();
    const now = Date.now();
    return db.prepare('SELECT * FROM sessions WHERE sessionId = ? AND expiresAt > ?').get(sessionId, now) as Session | undefined;
  },
  
  deleteSession: async (sessionId: string): Promise<void> => {
    const db = await getDb();
    await db.prepare('DELETE FROM sessions WHERE sessionId = ?').run(sessionId);
  },

  createSallaOAuthStateNonce: async (
    nonceHash: string,
    sessionId: string,
    expiresAt: number
  ): Promise<void> => {
    const db = await getDb();
    const now = Date.now();
    await db
      .prepare(`
        INSERT INTO salla_oauth_states (nonceHash, sessionId, expiresAt, createdAt)
        VALUES (?, ?, ?, ?)
      `)
      .run(nonceHash, sessionId, expiresAt, now);
  },

  consumeSallaOAuthStateNonce: async (
    nonceHash: string,
    sessionId: string,
    now: number
  ): Promise<boolean> => {
    const db = await getDb();
    const consumed = await db
      .prepare(`
        DELETE FROM salla_oauth_states
        WHERE nonceHash = ? AND sessionId = ? AND expiresAt > ?
        RETURNING nonceHash
      `)
      .get(nonceHash, sessionId, now);
    return Boolean(consumed);
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    const db = await getDb();
    return db.prepare('SELECT *, free_reports_used as freeReportsUsed FROM users WHERE id = ?').get(id) as User | undefined;
  },

  setEmailVerificationToken: async (userId: string, token: string, expiresAt: number): Promise<void> => {
    const db = await getDb();
    db.prepare(
      'UPDATE users SET email_verify_token = ?, email_verify_token_expires_at = ? WHERE id = ?'
    ).run(token, expiresAt, userId);
  },

  getUserByVerifyToken: async (token: string): Promise<User | undefined> => {
    const db = await getDb();
    return db
      .prepare(
        'SELECT *, free_reports_used as freeReportsUsed FROM users WHERE email_verify_token = ?'
      )
      .get(token) as User | undefined;
  },

  verifyEmailByToken: async (token: string): Promise<{ ok: boolean; userId?: string; reason?: string }> => {
    const db = await getDb();
    const debugEmailVerify =
      process.env.NODE_ENV !== 'production' ||
      process.env.DEBUG_EMAIL_VERIFY === '1';

    const cleanToken = typeof token === 'string' ? token.trim() : '';
    const countRow = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE email_verify_token = ?')
      .get(cleanToken) as { c?: number } | undefined;
    const countMatches = (countRow && typeof countRow.c === 'number' ? countRow.c : 0) || 0;

    const user = (await (dbService as any).getUserByVerifyToken(cleanToken)) as User | undefined;

    if (!user) {
      if (debugEmailVerify) {
        console.log('[email-verify] invalid token', {
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
        dbPath: DB_PATH,
      });
    }

    return { ok: true, userId: user.id };
  },

  updateUserPlan: async (userId: string, plan: string, expiresAt: number): Promise<void> => {
    const db = await getDb();
    db.prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?').run(plan, expiresAt, userId);
  },

  setUserPlanDev: async (userId: string, plan: string): Promise<void> => {
    const db = await getDb();
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
  },

  // Payment & Subscription operations
  createPayment: async (payment: any): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      INSERT INTO payments (id, userId, provider, providerPaymentId, amountHalala, currency, status, createdAt, rawJson)
      VALUES (@id, @userId, @provider, @providerPaymentId, @amountHalala, @currency, @status, @createdAt, @rawJson)
    `).run(payment);
  },

  createSubscription: async (subscription: any): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      INSERT INTO subscriptions (id, userId, planId, interval, status, startedAt, expiresAt, createdAt)
      VALUES (@id, @userId, @planId, @interval, @status, @startedAt, @expiresAt, @createdAt)
    `).run(subscription);
  },

  getSubscriptionByUserId: async (userId: string): Promise<any> => {
    const db = await getDb();
    return db.prepare('SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
  },

  // Store & Data operations
  getStoreConnection: async (userId: string): Promise<any> => {
    const db = await getDb();
    return db.prepare("SELECT * FROM store_connections WHERE userId = ? AND status = 'connected'").get(userId);
  },

  createOrUpdateStoreConnection: async (conn: any): Promise<void> => {
    const db = await getDb();
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

  disconnectStore: async (userId: string): Promise<void> => {
    const db = await getDb();
    db.prepare("UPDATE store_connections SET status = 'disconnected' WHERE userId = ?").run(userId);
  },

  upsertProduct: async (product: any): Promise<void> => {
    const db = await getDb();
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
  
  getProductByExternalId: async (userId: string, externalId: string): Promise<any | null> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM products 
      WHERE userId = ? AND externalId = ?
      ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
      LIMIT 1
    `).get(userId, externalId) || null;
  },

  // Product Costs
  getProductCost: async (productId: string): Promise<any | null> => {
    const db = await getDb();
    return db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(productId) || null;
  },

  upsertProductCost: async (productId: string, payload: Partial<{
    purchase_cost_halala: number;
    labor_cost_halala: number;
    shipping_cost_halala: number;
    packaging_cost_halala: number;
    ads_cost_per_unit_halala: number;
    payment_fee_percent_bps: number;
  }>): Promise<void> => {
    const db = await getDb();
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

  addOrder: async (order: any): Promise<void> => {
    const db = await getDb();
    // Insert order tied to a report; allow duplicates across reports
    db.prepare(`
      INSERT INTO orders (id, userId, platform, externalId, reportId, totalHalala, status, itemsCount, createdAt)
      VALUES (@id, @userId, @platform, @externalId, @reportId, @totalHalala, @status, @itemsCount, @createdAt)
    `).run(order);
  },

  insertOrderItem: async (item: {
    id: string;
    report_id: string;
    order_id: string;
    sku: string | null;
    product_name: string | null;
    qty: number;
    allocated_revenue: number;
    created_at: number;
  }): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      INSERT INTO order_items (id, report_id, order_id, sku, product_name, qty, allocated_revenue, created_at)
      VALUES (@id, @report_id, @order_id, @sku, @product_name, @qty, @allocated_revenue, @created_at)
    `).run(item);
  },

  // Backward-compatible upsert for older callers
  upsertOrder: async (order: any): Promise<void> => {
    const db = await getDb();
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

  getStoreStats: async (userId: string): Promise<any> => {
    const db = await getDb();
    const selectSummary = () => db.prepare(`
      SELECT products_count AS products, orders_count, sales_halala AS sales,
        excluded_orders_count AS excluded_count, excluded_sales_halala AS excluded_sales
      FROM user_runtime_summaries WHERE user_id = ?
    `).get(userId) as Promise<any>;
    let row = await selectSummary();

    if (!row) {
      // The NOT EXISTS guard is part of the write statement. D1 serializes writes, so
      // only the first missing-row request performs the historical scalar subqueries.
      await db.prepare(`
        INSERT INTO user_runtime_summaries (
          user_id, products_count, orders_count, sales_halala,
          excluded_orders_count, excluded_sales_halala, updated_at
        )
        SELECT ?,
          (SELECT COUNT(*) FROM products WHERE userId = ?),
          (SELECT COUNT(*) FROM orders WHERE userId = ? AND COALESCE(status, '') NOT IN ('ملغي', 'محذوف', 'ملغى')),
          (SELECT COALESCE(SUM(totalHalala), 0) FROM orders WHERE userId = ? AND COALESCE(status, '') NOT IN ('ملغي', 'محذوف', 'ملغى')),
          (SELECT COUNT(*) FROM orders WHERE userId = ? AND COALESCE(status, '') IN ('ملغي', 'محذوف', 'ملغى')),
          (SELECT COALESCE(SUM(totalHalala), 0) FROM orders WHERE userId = ? AND COALESCE(status, '') IN ('ملغي', 'محذوف', 'ملغى')),
          ?
        WHERE NOT EXISTS (SELECT 1 FROM user_runtime_summaries WHERE user_id = ?)
        ON CONFLICT(user_id) DO NOTHING
      `).run(userId, userId, userId, userId, userId, userId, Date.now(), userId);
      row = await selectSummary();
    }

    row ||= { products: 0, orders_count: 0, sales: 0, excluded_count: 0, excluded_sales: 0 };
    const totalOrders = row.orders_count || 0;
    const totalSalesHalala = row.sales || 0;
    const avgOrderValue = totalOrders > 0 ? Math.round((totalSalesHalala / totalOrders)) : 0;
    return {
      products: row.products || 0,
      orders: totalOrders,
      sales: totalSalesHalala,
      avgOrderValueHalala: avgOrderValue,
      excludedOrdersCount: row.excluded_count || 0,
      excludedSalesHalala: row.excluded_sales || 0
    };
  },

  // Costs identity helpers
  listDistinctProductsForUser: async (userId: string): Promise<Array<{
    identityKey: string;
    sku: string | null;
    externalId: string | null;
    name: string;
    latestPriceHalala: number | null;
    productIds: string[];
    costs: {
      is_configured: number;
      purchase_cost_halala: number;
      labor_cost_halala: number;
      shipping_cost_halala: number;
      packaging_cost_halala: number;
      ads_cost_per_unit_halala: number;
      payment_fee_percent_bps: number;
    };
  }>> => {
    const db = await getDb();
    type ProductCostRow = {
      id: string;
      sku: string | null;
      externalId: string | null;
      title: string | null;
      priceHalala: number | null;
      createdAt: number | null;
      updatedAt: number | null;
      is_configured: number;
      purchase_cost_halala: number;
      labor_cost_halala: number;
      shipping_cost_halala: number;
      packaging_cost_halala: number;
      ads_cost_per_unit_halala: number;
      payment_fee_percent_bps: number;
    };
    const rows = await db.prepare(`
      SELECT
        p.id, p.sku, p.externalId, p.title, p.priceHalala, p.createdAt, p.updatedAt,
        COALESCE(c.is_configured, 0) AS is_configured,
        COALESCE(c.purchase_cost_halala, 0) AS purchase_cost_halala,
        COALESCE(c.labor_cost_halala, 0) AS labor_cost_halala,
        COALESCE(c.shipping_cost_halala, 0) AS shipping_cost_halala,
        COALESCE(c.packaging_cost_halala, 0) AS packaging_cost_halala,
        COALESCE(c.ads_cost_per_unit_halala, 0) AS ads_cost_per_unit_halala,
        COALESCE(c.payment_fee_percent_bps, 0) AS payment_fee_percent_bps
      FROM products p
      LEFT JOIN product_costs c ON c.product_id = p.id
      WHERE p.userId = ?
      ORDER BY COALESCE(p.updatedAt, 0) DESC, COALESCE(p.createdAt, 0) DESC
      LIMIT 501
    `).all(userId) as ProductCostRow[];

    const normalizeName = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const map = new Map<string, {
      identityKey: string;
      sku: string | null;
      externalId: string | null;
      name: string;
      latestPriceHalala: number | null;
      productIds: string[];
      costs: {
        is_configured: number;
        purchase_cost_halala: number;
        labor_cost_halala: number;
        shipping_cost_halala: number;
        packaging_cost_halala: number;
        ads_cost_per_unit_halala: number;
        payment_fee_percent_bps: number;
      };
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
          productIds: [r.id],
          costs: {
            is_configured: r.is_configured || 0,
            purchase_cost_halala: r.purchase_cost_halala || 0,
            labor_cost_halala: r.labor_cost_halala || 0,
            shipping_cost_halala: r.shipping_cost_halala || 0,
            packaging_cost_halala: r.packaging_cost_halala || 0,
            ads_cost_per_unit_halala: r.ads_cost_per_unit_halala || 0,
            payment_fee_percent_bps: r.payment_fee_percent_bps || 0
          }
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

    return Array.from(map.values()).slice(0, 500);
  },

  getCostsByIdentity: async (identityKey: string, userId: string): Promise<any> => {
    const db = await getDb();
    const resolve = async (): Promise<string | null> => {
      const [prefix, ...rest] = identityKey.split(':');
      const value = rest.join(':').trim();
      if (!value) return null;
      if (prefix === 'sku') {
        const r = await db.prepare(`
          SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
        `).get(userId, value) as any;
        return r?.id || null;
      } else if (prefix === 'ext') {
        const r = await db.prepare(`
          SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(externalId,'')) = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
        `).get(userId, value) as any;
        return r?.id || null;
      } else if (prefix === 'name') {
        const rows = await db.prepare(`
          SELECT id, title FROM products WHERE userId = ? 
          ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
          LIMIT 501
        `).all(userId) as any[];
        const normalized = (value || '').toLowerCase();
        for (const row of rows) {
          const name = (row.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (name === normalized) return row.id;
        }
      }
      return null;
    };
    const productId = await resolve();
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
    const cost = await db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(productId) as any;
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

  upsertCostsByIdentity: async (identityKey: string, userId: string, payload: {
    purchase_cost_halala?: number;
    labor_cost_halala?: number;
    shipping_cost_halala?: number;
    packaging_cost_halala?: number;
    ads_cost_per_unit_halala?: number;
    payment_fee_percent_bps?: number;
  }): Promise<void> => {
    const db = await getDb();
    const [prefix, ...rest] = identityKey.split(':');
    const value = rest.join(':').trim();
    let productId: string | null = null;
    if (prefix === 'sku') {
      const r = await db.prepare(`
        SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
      `).get(userId, value) as any;
      productId = r?.id || null;
    } else if (prefix === 'ext') {
      const r = await db.prepare(`
        SELECT id FROM products WHERE userId = ? AND TRIM(COALESCE(externalId,'')) = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC LIMIT 1
      `).get(userId, value) as any;
      productId = r?.id || null;
    } else if (prefix === 'name') {
      const rows = await db.prepare(`
        SELECT id, title FROM products WHERE userId = ? 
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 501
      `).all(userId) as any[];
      const normalized = (value || '').toLowerCase();
      for (const row of rows) {
        const name = (row.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (name === normalized) { productId = row.id; break; }
      }
    }
    if (!productId) throw new Error('Product not found for identity');
    await (exports as any).dbService.upsertProductCost(productId, payload);
  },

  // Report operations
  saveReport: async (report: any): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      INSERT INTO reports (id, userId, storeId, reportJson, createdAt)
      VALUES (@id, @userId, @storeId, @reportJson, @createdAt)
    `).run(report);
  },

  createEmptyReport: async (id: string, userId: string, storeId?: string): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      INSERT INTO reports (id, userId, storeId, reportJson, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, storeId || null, JSON.stringify({ status: 'pending' }), Date.now());
  },

  updateReportJsonForUser: async (userId: string, id: string, reportJson: string): Promise<void> => {
    const db = await getDb();
    db.prepare(`
      UPDATE reports SET reportJson = ? WHERE id = ? AND userId = ?
    `).run(reportJson, id, userId);
  },

  getReportForUser: async (userId: string, id: string): Promise<any> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM reports WHERE id = ? AND userId = ?
    `).get(id, userId);
  },

  listReportsByUser: async (userId: string): Promise<any[]> => {
    const db = await getDb();
    return db.prepare('SELECT * FROM reports WHERE userId = ? ORDER BY createdAt DESC').all(userId) as any[];
  },

  getLatestReport: async (userId: string): Promise<any> => {
    const db = await getDb();
    return db.prepare('SELECT * FROM reports WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
  },

  incrementFreeReports: async (userId: string): Promise<void> => {
    const db = await getDb();
    db.prepare('UPDATE users SET free_reports_used = COALESCE(free_reports_used, 0) + 1 WHERE id = ?').run(userId);
  },

  // Report snapshots
  getSnapshotByHash: async (userId: string, sourceHash: string): Promise<any | null> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM report_snapshots 
      WHERE user_id = ? AND source_hash = ?
      LIMIT 1
    `).get(userId, sourceHash) || null;
  },
  insertSnapshot: async (row: any): Promise<void> => {
    const db = await getDb();
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
  listSnapshots: async (userId: string, limit: number = 12): Promise<any[]> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM report_snapshots
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];
  },
  getSnapshotById: async (userId: string, id: string): Promise<any | null> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM report_snapshots WHERE user_id = ? AND id = ?
    `).get(userId, id) || null;
  },
  getPreviousSnapshot: async (userId: string, timeRangeStart: number): Promise<any | null> => {
    const db = await getDb();
    return db.prepare(`
      SELECT * FROM report_snapshots 
      WHERE user_id = ? AND time_range_end < ?
      ORDER BY time_range_end DESC
      LIMIT 1
    `).get(userId, timeRangeStart) || null;
  }
};
