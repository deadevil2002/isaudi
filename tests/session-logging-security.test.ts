import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  expiredSessionCookieOptions,
  sessionCookieOptions,
} from '../src/lib/auth/session-cookie';

test('production session cookie has finite secure browser flags compatible with redirects', () => {
  const expiresAt = Date.now() + 1000;
  assert.deepEqual(sessionCookieOptions(expiresAt, true), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 2_592_000,
    expires: new Date(expiresAt),
  });
});

test('logout cookie always expires with the same protected scope', () => {
  const options = expiredSessionCookieOptions(true);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(options.maxAge, 0);
  assert.equal(options.expires.getTime(), 0);
});

test('D1 authentication rejects expired sessions and logout always clears the cookie', async () => {
  const auth = await readFile(new URL('../src/lib/auth/utils.ts', import.meta.url), 'utf8');
  const logout = await readFile(
    new URL('../src/app/api/auth/logout/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(auth, /sessionId = \? AND expiresAt > \?/);
  assert.match(logout, /expiredSessionCookieOptions/);
});

test('changed provider and verification paths do not log or reflect sensitive payloads', async () => {
  const paths = [
    '../src/app/api/billing/tap/create-payment/route.ts',
    '../src/app/api/connect/salla/callback/route.ts',
    '../src/app/api/auth/send-verification/route.ts',
    '../src/app/api/auth/verify-otp/route.ts',
  ];
  const source = (
    await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
  ).join('\n');
  for (const forbidden of [
    'tokenPrefix',
    'rowTokenPrefix',
    'Salla Token Error:',
    'details: tapJson',
    'body: tapJson',
    'body: tapResText',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});