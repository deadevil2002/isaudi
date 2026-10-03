import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; the project intentionally retains Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import { limiterDigest } from '../src/lib/auth/otp';
import { authenticateBusinessApiRequest } from '../src/lib/business-api/auth';
import { BUSINESS_API_RATE_LIMIT } from '../src/lib/business-api/contracts';
import type { BusinessApiD1, BusinessApiStatement } from '../src/lib/business-api/db';
import {
  accountResource,
  createBusinessApiRoute,
  reportDetailResource,
  reportsResource,
  storesResource,
} from '../src/lib/business-api/handler';
import {
  createBusinessApiKey,
  revokeBusinessApiKey,
  rotateBusinessApiKey,
} from '../src/lib/business-api/key-service';
import { createBusinessApiManagementHandler } from '../src/lib/business-api/management';
import { getPlanLimits } from '../src/lib/subscription/plans';

const SECRET = 'test-only-business-api-hmac-secret-with-sufficient-length';
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
process.env.OTP_HMAC_SECRET = SECRET;

type Executable = BusinessApiStatement & { execute(): unknown };

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE otp_rate_limits (key_hash TEXT NOT NULL, window_start INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(key_hash, window_start));
    CREATE TABLE salla_connections (
      merchantId TEXT PRIMARY KEY, userId TEXT, status TEXT NOT NULL,
      storeName TEXT, storefrontOrigin TEXT, updatedAt INTEGER NOT NULL,
      accessTokenEncrypted TEXT, refreshTokenEncrypted TEXT,
      FOREIGN KEY(userId) REFERENCES users(id));
    CREATE TABLE report_snapshots (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      time_range_start INTEGER NOT NULL, time_range_end INTEGER NOT NULL,
      gross_sales_halala INTEGER NOT NULL, orders_count INTEGER NOT NULL,
      total_profit_halala INTEGER NOT NULL, margin_pct_x100 INTEGER NOT NULL,
      missing_cost_products_count INTEGER NOT NULL, missing_cost_sales_halala INTEGER NOT NULL,
      report_json TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE INDEX idx_report_snapshots_user_end ON report_snapshots(user_id, time_range_end DESC);
    INSERT INTO users VALUES ('tenant-a','a@example.test'), ('tenant-b','b@example.test');
  `);
  sqlite.exec(readFileSync(new URL('../migrations/0025_business_api_access.sql', import.meta.url), 'utf8'));

  const db: BusinessApiD1 = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const executable: Executable = {
        bind(...input: unknown[]) { values = input; return executable; },
        async first<T>() { return (sqlite.prepare(sql).get(...values as never[]) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...values as never[]) as T[] }; },
        async run() { return sqlite.prepare(sql).run(...values as never[]) as unknown as { success?: boolean; meta?: { changes?: number } }; },
        execute() { return sqlite.prepare(sql).run(...values as never[]); },
      };
      return executable;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => (statement as Executable).execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, db };
}

function entitlements(plan: 'starter' | 'growth' | 'business', active = true) {
  return async () => ({
    ok: true, planId: plan, status: active ? 'active' as const : 'expired' as const,
    startedAt: NOW - 1000, expiresAt: active ? NOW + 100_000 : NOW - 1,
    isActiveNow: active, cancelAtPeriodEnd: false, limits: getPlanLimits(plan),
  });
}

function request(path: string, key?: string, extraHeaders?: HeadersInit) {
  return new Request(`https://api.example.test${path}`, { headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...extraHeaders } });
}

test('migration stores digests, safe prefixes, scopes and aggregate usage without plaintext columns', () => {
  const migration = readFileSync(new URL('../migrations/0025_business_api_access.sql', import.meta.url), 'utf8');
  assert.match(migration, /secret_hash TEXT NOT NULL UNIQUE/);
  assert.match(migration, /business_api_usage_daily/);
  assert.match(migration, /business_api_admin_summary/);
  assert.doesNotMatch(migration, /plaintext\s+TEXT|authorization_header\s+TEXT|accessTokenEncrypted|refreshTokenEncrypted/i);
});

test('server generates a recognizable high-entropy key and never persists plaintext', async () => {
  const { sqlite, db } = database();
  const created = await createBusinessApiKey(db, { userId: 'tenant-a', name: 'ERP', scopes: ['account:read'], now: NOW });
  assert.match(created.secret, /^isaudi_api_[A-Za-z0-9_-]{43}$/);
  assert.match(created.key.prefix, /^isaudi_api_[A-Za-z0-9_-]{8}$/);
  const row = sqlite.prepare('SELECT * FROM business_api_keys').get() as Record<string, unknown>;
  assert.notEqual(row.secret_hash, created.secret);
  assert.equal(JSON.stringify(row).includes(created.secret), false);
  assert.equal(row.user_id, 'tenant-a');
});

test('missing, malformed, query-string, unknown, expired, and revoked keys return stable safe errors', async () => {
  const { sqlite, db } = database();
  const created = await createBusinessApiKey(db, { userId: 'tenant-a', name: 'ERP', scopes: ['account:read'], now: NOW });
  const inputs = [
    request('/api/v1/account'),
    request('/api/v1/account', 'not-an-isaudi-key'),
    request(`/api/v1/account?api_key=${created.secret}`, created.secret),
    request('/api/v1/account', `isaudi_api_${'x'.repeat(43)}`),
  ];
  for (const item of inputs) {
    const result = await authenticateBusinessApiRequest({ request: item, db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements('business') });
    assert.ok('response' in result);
    assert.ok([400, 401].includes(result.response.status));
    assert.doesNotMatch(await result.response.text(), /SQL|stack|secret_hash/i);
  }
  sqlite.prepare('UPDATE business_api_keys SET expires_at=? WHERE id=?').run(NOW - 1, created.key.id);
  let result = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements('business') });
  assert.equal('response' in result && result.response.status, 401);
  sqlite.prepare('UPDATE business_api_keys SET expires_at=NULL WHERE id=?').run(created.key.id);
  assert.equal(await revokeBusinessApiKey(db, 'tenant-a', created.key.id, NOW), true);
  result = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements('business') });
  assert.equal('response' in result && result.response.status, 401);
});

test('Starter and Growth are denied, Business is allowed, and scopes are enforced server-side', async () => {
  const { db } = database();
  const created = await createBusinessApiKey(db, { userId: 'tenant-a', name: 'ERP', scopes: ['account:read'], now: NOW });
  for (const plan of ['starter', 'growth'] as const) {
    const denied = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements(plan) });
    assert.equal('response' in denied && denied.response.status, 403);
  }
  const allowed = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements('business') });
  assert.ok('auth' in allowed);
  const wrongScope = await authenticateBusinessApiRequest({ request: request('/api/v1/stores', created.secret), db, requiredScope: 'stores:read', now: NOW, getEntitlements: entitlements('business') });
  assert.equal('response' in wrongScope && wrongScope.response.status, 403);
});

test('management is session-authenticated, Business-only, same-origin, bounded, revocable, and rotatable', async () => {
  const { db } = database();
  const denied = createBusinessApiManagementHandler({ action: 'create', getUser: async () => ({ id: 'tenant-a' }), getEntitlements: entitlements('growth'), getDb: () => db });
  assert.equal((await denied(new Request('https://app.test/api/business-api/keys', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: '{}' }))).status, 403);
  const create = createBusinessApiManagementHandler({ action: 'create', getUser: async () => ({ id: 'tenant-a' }), getEntitlements: entitlements('business'), getDb: () => db });
  assert.equal((await create(new Request('https://app.test/api/business-api/keys', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' }))).status, 403);
  assert.equal((await create(new Request('https://app.test/api/business-api/keys', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: '{' }))).status, 400);
  const createdResponse = await create(new Request('https://app.test/api/business-api/keys', { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'ERP', scopes: ['account:read', 'reports:read'] }) }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as { key: { id: string }; secret: string };
  const rotated = await rotateBusinessApiKey(db, { userId: 'tenant-a', keyId: created.key.id, now: NOW + 1 });
  assert.ok(rotated);
  assert.notEqual(rotated.secret, created.secret);
  const old = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW + 2, getEntitlements: entitlements('business') });
  assert.equal('response' in old && old.response.status, 401);
  const current = await authenticateBusinessApiRequest({ request: request('/api/v1/account', rotated.secret), db, requiredScope: 'account:read', now: NOW + 2, getEntitlements: entitlements('business') });
  assert.ok('auth' in current);
});

test('account and stores expose only owner-scoped safe metadata, never Salla credentials', async () => {
  const { sqlite, db } = database();
  sqlite.exec(`INSERT INTO salla_connections VALUES
    ('merchant-a','tenant-a','connected','A','https://a.example',${NOW},'token-a','refresh-a'),
    ('merchant-b','tenant-b','connected','B','https://b.example',${NOW},'token-b','refresh-b');`);
  const auth = { keyId: 'key-a', userId: 'tenant-a', prefix: 'isaudi_api_demo', scopes: ['account:read', 'stores:read'] as const };
  const account = await accountResource({ request: request('/api/v1/account'), db, auth: { ...auth, scopes: [...auth.scopes] } });
  assert.match(await account.text(), /a@example\.test/);
  const stores = await storesResource({ request: request('/api/v1/stores'), db, auth: { ...auth, scopes: [...auth.scopes] } });
  const body = await stores.text();
  assert.match(body, /merchant-a/);
  assert.doesNotMatch(body, /merchant-b|token-a|refresh-a|token-b|refresh-b/);
});

test('versioned route authenticates, records safe status/latency aggregates, and stays no-store', async () => {
  const { sqlite, db } = database();
  const created = await createBusinessApiKey(db, { userId: 'tenant-a', name: 'BI', scopes: ['account:read'], now: NOW });
  const route = createBusinessApiRoute({ scope: 'account:read', endpoint: 'account', resource: accountResource, getDb: () => db, getEntitlements: entitlements('business'), now: () => NOW });
  const response = await route(request('/api/v1/account', created.secret));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const key = sqlite.prepare('SELECT request_count,error_count,last_used_at FROM business_api_keys WHERE id=?').get(created.key.id) as Record<string, number>;
  assert.deepEqual({ requests: key.request_count, errors: key.error_count, used: key.last_used_at }, { requests: 1, errors: 0, used: NOW });
  const usage = sqlite.prepare('SELECT endpoint,request_count,success_count,error_count FROM business_api_usage_daily').get() as Record<string, number | string>;
  assert.deepEqual({ ...usage }, { endpoint: 'account', request_count: 1, success_count: 1, error_count: 0 });
  const summary = sqlite.prepare('SELECT request_count,error_count,rate_limit_count FROM business_api_admin_summary WHERE id=1').get() as Record<string, number>;
  assert.deepEqual({ ...summary }, { request_count: 1, error_count: 0, rate_limit_count: 0 });
});

test('reports use bounded cursor pagination and report detail fails closed across tenants', async () => {
  const { sqlite, db } = database();
  const insert = sqlite.prepare(`INSERT INTO report_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run('report-a', 'tenant-a', NOW, NOW - 1000, NOW, 10000, 2, 4000, 4000, 0, 0, JSON.stringify({
    summary: 'Owned',
    systemPrompt: 'never expose',
    partner: { commission: 10 },
    aiNarrative: { executiveSummary: 'Safe summary', systemPrompt: 'nested secret' },
    top_products: [{ name: 'Safe product', revenue: 100, internalToken: 'nested secret' }],
  }));
  insert.run('report-b', 'tenant-b', NOW, NOW - 1000, NOW, 99999, 9, 9000, 900, 0, 0, JSON.stringify({ summary: 'Other tenant' }));
  const auth = { keyId: 'key-a', userId: 'tenant-a', prefix: 'isaudi_api_demo', scopes: ['reports:read'] as const };
  const list = await reportsResource({ request: request('/api/v1/reports?limit=1'), db, auth: { ...auth, scopes: [...auth.scopes] } });
  const text = await list.text();
  assert.match(text, /report-a/);
  assert.doesNotMatch(text, /report-b|Other tenant/);
  const oversized = await reportsResource({ request: request('/api/v1/reports?limit=1000000'), db, auth: { ...auth, scopes: [...auth.scopes] } });
  assert.equal(oversized.status, 400);
  const foreign = await reportDetailResource({ request: request('/api/v1/reports/report-b'), db, auth: { ...auth, scopes: [...auth.scopes] }, params: { id: 'report-b' } });
  assert.equal(foreign.status, 404);
  const traversal = await reportDetailResource({ request: request('/api/v1/reports/..%2Fadmin'), db, auth: { ...auth, scopes: [...auth.scopes] }, params: { id: '../admin' } });
  assert.equal(traversal.status, 400);
  const owned = await reportDetailResource({ request: request('/api/v1/reports/report-a'), db, auth: { ...auth, scopes: [...auth.scopes] }, params: { id: 'report-a' } });
  const ownedText = await owned.text();
  assert.match(ownedText, /Owned/);
  assert.doesNotMatch(ownedText, /systemPrompt|partner|commission|internalToken|nested secret/);
});

test('per-key rate limiting returns 429 without logging or returning the credential', async () => {
  const { sqlite, db } = database();
  const created = await createBusinessApiKey(db, { userId: 'tenant-a', name: 'ERP', scopes: ['account:read'], now: NOW });
  const windowStart = Math.floor(NOW / BUSINESS_API_RATE_LIMIT.windowMs) * BUSINESS_API_RATE_LIMIT.windowMs;
  const digest = limiterDigest(`business-api-rate:key:${created.key.id}`, true, SECRET);
  sqlite.prepare('INSERT INTO otp_rate_limits VALUES (?,?,?,?)').run(digest, windowStart, windowStart + BUSINESS_API_RATE_LIMIT.windowMs, BUSINESS_API_RATE_LIMIT.key);
  const limited = await authenticateBusinessApiRequest({ request: request('/api/v1/account', created.secret), db, requiredScope: 'account:read', now: NOW, getEntitlements: entitlements('business') });
  assert.equal('response' in limited && limited.response.status, 429);
  assert.equal('response' in limited && limited.response.headers.get('retry-after') !== null, true);
  assert.equal('response' in limited && (await limited.response.text()).includes(created.secret), false);
  const source = [
    readFileSync(new URL('../src/lib/business-api/auth.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/lib/business-api/handler.ts', import.meta.url), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(source, /console\.(log|error)\([^)]*(authorization|plaintext)/i);
});

test('customer UI shows one-time secret warning, scope selection, accessible revoke/rotate confirmations, docs, and upgrade path', () => {
  const ui = readFileSync(new URL('../src/app/(authenticated)/settings/api-access-panel.tsx', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('../src/components/ui/app-dialog.tsx', import.meta.url), 'utf8');
  const docs = readFileSync(new URL('../src/app/(authenticated)/docs/api/page.tsx', import.meta.url), 'utf8');
  assert.match(ui, /لن تتمكن من رؤيته مرة أخرى/);
  assert.doesNotMatch(ui, /window\.confirm/);
  assert.match(ui, /<AppDialog/);
  assert.match(ui, /variant=\{pendingAction\?\.type === "revoke" \? "destructive" : "warning"\}/);
  assert.match(dialog, /"alertdialog"/);
  assert.match(dialog, /\.showModal\(\)/);
  assert.match(dialog, /onCancel=/);
  assert.match(dialog, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(dialog, /motion-reduce:open:animate-none/);
  assert.match(ui, /account:read/);
  assert.match(ui, /stores:read/);
  assert.match(ui, /reports:read/);
  assert.match(ui, /min-h-11/);
  assert.match(ui, /ترقية الخطة/);
  assert.match(docs, /Authorization: Bearer <API_KEY>/);
  assert.match(docs, /120 requests per key/);
  assert.doesNotMatch(docs, /admin:\*|billing:write|salla:credentials|cross_store:read/);
});

test('public API code contains no wildcard CORS, mutation methods, Salla secrets, OpenAI secrets, cross-store, or partner data', () => {
  const handler = readFileSync(new URL('../src/lib/business-api/handler.ts', import.meta.url), 'utf8');
  const routes = [
    '../src/app/api/v1/account/route.ts', '../src/app/api/v1/stores/route.ts',
    '../src/app/api/v1/reports/route.ts', '../src/app/api/v1/reports/[id]/route.ts',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(`${handler}\n${routes}`, /Access-Control-Allow-Origin|POST\s*=|PUT\s*=|PATCH\s*=|DELETE\s*=/);
  assert.doesNotMatch(handler, /accessTokenEncrypted|refreshTokenEncrypted|OPENAI_API_KEY|systemPrompt|cross_store|partner_offers|commission/i);
  assert.match(routes, /export const GET/);
});
