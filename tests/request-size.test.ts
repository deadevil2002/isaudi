import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  bodySizeGuard,
  readJsonWithLimit,
  readTextWithLimit,
  requestBodyLimit,
} from '../src/lib/security/request-size';

test('normal JSON is accepted and parsed', async () => {
  const request = new Request('https://isaudi.ai/api/costs/upsert', {
    method: 'POST',
    body: JSON.stringify({ amount: 25 }),
  });
  assert.deepEqual(await readJsonWithLimit(request, REQUEST_BODY_LIMITS.json), { amount: 25 });
});

test('oversized declared and streamed JSON is rejected with 413 semantics', async () => {
  const declared = new Request('https://isaudi.ai/api/costs/upsert', {
    method: 'POST',
    headers: { 'content-length': String(REQUEST_BODY_LIMITS.json + 1) },
  });
  assert.equal(bodySizeGuard(declared)?.status, 413);

  const streamed = new Request('https://isaudi.ai/api/costs/upsert', {
    method: 'POST',
    body: 'x'.repeat(REQUEST_BODY_LIMITS.json + 1),
  });
  await assert.rejects(
    () => readTextWithLimit(streamed, REQUEST_BODY_LIMITS.json),
    RequestBodyTooLargeError
  );
});

test('legitimate webhook payload allowance remains bounded and usable', async () => {
  const payload = JSON.stringify({ id: 'chg_1', padding: 'x'.repeat(64 * 1024) });
  const request = new Request('https://isaudi.ai/api/billing/tap/webhook', {
    method: 'POST',
    body: payload,
  });
  assert.equal(await readTextWithLimit(request, REQUEST_BODY_LIMITS.webhook), payload);
});

test('endpoint-specific limits preserve normal CSV imports', () => {
  assert.equal(requestBodyLimit('/api/auth/request-otp'), 4 * 1024);
  assert.equal(requestBodyLimit('/api/analysis/chat'), 256 * 1024);
  assert.equal(requestBodyLimit('/api/billing/tap/webhook'), 512 * 1024);
  assert.equal(requestBodyLimit('/api/connect/csv/upload'), 12 * 1024 * 1024);
});