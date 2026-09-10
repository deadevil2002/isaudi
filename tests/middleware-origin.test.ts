import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CSRF_PROTECTED_PATHS,
  ORIGIN_PROTECTED_POST_PATHS,
  originGuard,
} from '../src/lib/security/origin';

const request = (
  path: string,
  headers: Record<string, string> = {},
  method = 'POST'
) =>
  new Request(`https://isaudi.ai${path}`, {
    method,
    headers,
  });

test('exports the exact protected POST allowlist', () => {
  assert.deepEqual(CSRF_PROTECTED_PATHS, ORIGIN_PROTECTED_POST_PATHS);
  assert.equal(CSRF_PROTECTED_PATHS.length, 11);
  assert.ok(CSRF_PROTECTED_PATHS.includes('/api/analysis/chat'));
  assert.ok(CSRF_PROTECTED_PATHS.includes('/api/connect/salla/link-code'));
});

test('production accepts the canonical Origin and rejects invalid or missing origins', () => {
  assert.equal(
    originGuard(request('/api/analysis/chat', { Origin: 'https://isaudi.ai' }), true),
    null
  );
  assert.equal(
    originGuard(
      request('/api/analysis/chat', { Origin: 'https://evil.example' }),
      true
    )?.status,
    403
  );
  assert.equal(originGuard(request('/api/analysis/chat'), true)?.status, 403);
});

test('production falls back to a trusted Referer only when Origin is absent', () => {
  assert.equal(
    originGuard(
      request('/api/costs/upsert', { Referer: 'https://isaudi.ai/dashboard' }),
      true
    ),
    null
  );
  assert.equal(
    originGuard(
      request('/api/costs/upsert', {
        Referer: 'https://isaudi.ai/dashboard',
        Origin: 'https://evil.example',
      }),
      true
    )?.status,
    403
  );
  assert.equal(
    originGuard(
      request('/api/costs/upsert', { Referer: 'https://evil.example/form' }),
      true
    )?.status,
    403
  );
});

test('development allows local and Replit origins, but not in production', () => {
  assert.equal(
    originGuard(
      request('/api/billing/verify', { Origin: 'http://localhost:3000' }),
      false
    ),
    null
  );
  assert.equal(
    originGuard(
      request('/api/billing/verify', {
        Origin: 'https://preview-abc.replit.dev',
      }),
      false
    ),
    null
  );
  assert.equal(
    originGuard(
      request('/api/billing/verify', { Origin: 'https://replit.dev' }),
      false
    )?.status,
    403
  );
});

test('GET reads and excluded endpoints are not protected', () => {
  assert.equal(originGuard(request('/api/analysis/chat', {}, 'GET'), true), null);
  for (const path of [
    '/api/auth/request-otp',
    '/api/auth/verify-otp',
    '/api/auth/verify-email',
    '/api/connect/salla/start',
    '/api/connect/salla/callback',
    '/api/webhooks/salla',
    '/api/webhooks/tap',
  ]) {
    assert.equal(originGuard(request(path), true), null, path);
  }
});