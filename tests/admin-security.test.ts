import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_COOKIE,
  INITIAL_ADMIN_EMAIL,
  PBKDF2_ITERATIONS,
  adminCookieOptions,
  expiredAdminCookieOptions,
  hashPassword,
  hmacPseudonym,
  timingSafeEqual,
  validPassword,
  verifyPassword,
} from '../src/lib/admin/security';
import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';
import { originGuard } from '../src/lib/security/origin';
import { normalizeEmail } from '../src/lib/auth/email';
import { readFile } from 'node:fs/promises';
import { REQUEST_BODY_LIMITS, requestBodyLimit } from '../src/lib/security/request-size';

test('admin identity and cookie are strictly isolated', () => {
  assert.equal(INITIAL_ADMIN_EMAIL, 'isaudiofficial@gmail.com');
  assert.equal(INITIAL_ADMIN_EMAIL, normalizeEmail('isaudi.official@gmail.com'));
  assert.equal(ADMIN_COOKIE, 'isaudi_admin_session');
  const expires = Date.now() + 10_000;
  const cookie = adminCookieOptions(expires);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, '/admin');
  assert.equal(cookie.expires.getTime(), expires);
  assert.equal(expiredAdminCookieOptions().maxAge, 0);
});

test('admin schema enforces one super admin and conditional claims', async () => {
  const migration = await readFile(
    new URL('../migrations/0009_admin_portal.sql', import.meta.url),
    'utf8'
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_single_super_admin/
  );
  assert.match(migration, /WHERE role = 'super_admin'/);
  assert.match(migration, /claim_hash TEXT UNIQUE/g);
});

test('admin routes use an exclusive no-referrer policy', () => {
  const adminResponse = middleware(
    new NextRequest('https://isaudi.ai/admin/api/status')
  );
  const publicResponse = middleware(
    new NextRequest('https://isaudi.ai/pricing')
  );

  assert.equal(adminResponse.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(
    publicResponse.headers.get('Referrer-Policy'),
    'strict-origin-when-cross-origin'
  );
});

test('admin pseudonyms are keyed, deterministic, and domain separated', async () => {
  const first = await hmacPseudonym('ip:203.0.113.1');
  assert.equal(first, await hmacPseudonym('ip:203.0.113.1'));
  assert.notEqual(first, await hmacPseudonym('limit:203.0.113.1'));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('PBKDF2 uses strong work factor, random salts and verifies safely', async () => {
  const password = 'a sufficiently long password';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.ok(PBKDF2_ITERATIONS >= 300_000);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword(password, first.hash, first.salt, first.iterations), true);
  assert.equal(await verifyPassword('incorrect password', first.hash, first.salt, first.iterations), false);
  assert.equal(timingSafeEqual(first.hash, first.hash), true);
  assert.equal(timingSafeEqual(first.hash, `${first.hash}00`), false);
});

test('admin password policy rejects short and oversized passwords', () => {
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('12345678901234'), true);
  assert.equal(validPassword('x'.repeat(201)), false);
});

test('all admin state changes require a trusted browser origin', () => {
  const make = (origin?: string) => new Request('https://isaudi.ai/admin/api/login', {
    method: 'POST', headers: origin ? { Origin: origin } : {},
  });
  assert.equal(originGuard(make('https://isaudi.ai'), true), null);
  assert.equal(originGuard(make(), true)?.status, 403);
  assert.equal(originGuard(make('https://evil.example'), true)?.status, 403);
  assert.equal(originGuard(new Request('https://isaudi.ai/admin/api/data'), true), null);
});

test('admin mutation bodies use the strict auth limit', () => {
  assert.equal(requestBodyLimit('/admin/api/login'), REQUEST_BODY_LIMITS.auth);
  assert.equal(requestBodyLimit('/admin/api/confirm-transfer'), REQUEST_BODY_LIMITS.auth);
});