import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('hardening migration covers justified hot query indexes', async () => {
  const migration = await source('../migrations/0015_security_scalability_hardening.sql');
  for (const index of [
    'idx_sessions_expires_at', 'idx_users_email_verify_token',
    'idx_store_connections_user_status', 'idx_store_connections_user_platform',
    'idx_products_user_external_updated', 'idx_products_user_sku_updated',
    'idx_orders_user_external', 'idx_orders_user_created',
    'idx_reports_user_created', 'idx_admin_sessions_expires_at',
    'idx_otp_rate_limits_expires_at', 'idx_order_items_order',
  ]) assert.match(migration, new RegExp(index));
});

test('global cleanup and schema creation are absent from request hot paths', async () => {
  const [service, adminDb, otpRequest, otpVerify, chat] = await Promise.all([
    source('../src/lib/db/service.ts'), source('../src/lib/admin/db.ts'),
    source('../src/app/api/auth/request-otp/route.ts'),
    source('../src/app/api/auth/verify-otp/route.ts'), source('../src/lib/ai/chat-guard.ts'),
  ]);
  assert.doesNotMatch(service, /DELETE FROM sessions WHERE expiresAt/);
  assert.doesNotMatch(service, /CREATE TABLE IF NOT EXISTS salla_oauth_states/);
  for (const value of [service, otpRequest, otpVerify]) assert.doesNotMatch(value, /DELETE FROM otp_rate_limits/);
  assert.doesNotMatch(adminDb, /DELETE FROM admin_rate_limits WHERE expires_at/);
  assert.doesNotMatch(chat, /DELETE FROM ai_chat_rate_limits WHERE expires_at/);
});

test('dashboard auth and aggregate work are request-efficient', async () => {
  const [auth, service, layout, dashboard] = await Promise.all([
    source('../src/lib/auth/utils.ts'), source('../src/lib/db/service.ts'),
    source('../src/app/(authenticated)/layout.tsx'),
    source('../src/app/(authenticated)/dashboard/page.tsx'),
  ]);
  assert.match(auth, /cache\(async function getCurrentUser/);
  assert.match(layout, /getCurrentUser/);
  assert.match(dashboard, /getCurrentUser/);
  const stats = service.match(/getStoreStats:[\s\S]*?\/\/ Costs identity helpers/)?.[0] || '';
  assert.equal((stats.match(/\.prepare\(/g) || []).length, 1);
  assert.match(stats, /const row = await db\.prepare/);
  assert.match(stats, /SUM\(CASE WHEN/);
});

test('Admin rows are allowlisted, lazy, paginated, and bounded', async () => {
  const route = await source('../src/app/admin/api/[action]/route.ts');
  assert.match(route, /const ADMIN_SECTIONS =/);
  assert.match(route, /pageSize = Math\.min\(50/);
  assert.match(route, /LIMIT \? OFFSET \?/);
  assert.match(route, /action === 'section'/);
  assert.doesNotMatch(route, /ORDER BY createdAt DESC LIMIT 200/);
});

test('public signed video lookup has short burst caching and request coalescing', async () => {
  const video = await source('../src/lib/video/public.ts');
  assert.match(video, /let pending: Promise<PublicVideo>/);
  assert.match(video, /value\.status === 'ready' \? 15_000 : 5_000/);
  assert.match(video, /createPlaybackUrl/);
});
