import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifySallaWebhookSignature } from '../src/lib/salla/webhook-signature';

const secret = 'test-only-webhook-secret';
const body = '{"event":"order.created","data":{"id":123}}';
const signature = createHmac('sha256', secret).update(body).digest('hex');

test('a valid Salla webhook signature is accepted', () => {
  assert.equal(verifySallaWebhookSignature(body, signature, secret), true);
});

test('an invalid Salla webhook signature is rejected', () => {
  const invalidSignature = `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
  assert.equal(
    verifySallaWebhookSignature(body, invalidSignature, secret),
    false
  );
});

test('a missing Salla webhook signature is rejected', () => {
  assert.equal(verifySallaWebhookSignature(body, null, secret), false);
});

test('a modified webhook body is rejected with the original signature', () => {
  const modifiedBody = '{"event":"order.deleted","data":{"id":123}}';
  assert.equal(
    verifySallaWebhookSignature(modifiedBody, signature, secret),
    false
  );
});