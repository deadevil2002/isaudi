import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sendVerifyEmail } from '../src/lib/email/resend';

test('verification email infers Resend when a Worker secret is present', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({ id: 'email-test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await sendVerifyEmail(
      'customer@example.com',
      'https://staging.example.com/verify?token=redacted-test-token',
      {
        RESEND_API_KEY: 'test-only-key',
        RESEND_FROM: 'iSaudi Staging <no-reply@updates.isaudi.ai>',
      },
      true
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verification email propagates a Resend delivery failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'rejected' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    await assert.rejects(
      sendVerifyEmail(
        'customer@example.com',
        'https://staging.example.com/verify?token=redacted-test-token',
        {
          RESEND_API_KEY: 'test-only-key',
          RESEND_FROM: 'iSaudi Staging <no-reply@updates.isaudi.ai>',
        },
        true
      ),
      /Verification email delivery failed/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production verification fails closed when email is not configured', async () => {
  await assert.rejects(
    sendVerifyEmail(
      'customer@example.com',
      'https://staging.example.com/verify?token=redacted-test-token',
      {},
      true
    ),
    /Verification email service is not configured/
  );
});

test('email verification uses the approved D1 schema and awaits every token write', async () => {
  const [service, initialSchema, tokenMigration] = await Promise.all([
    readFile(new URL('../src/lib/db/service.ts', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'),
    readFile(
      new URL('../migrations/0002_add_email_verify_columns.sql', import.meta.url),
      'utf8'
    ),
  ]);
  const approvedSchema = `${initialSchema}\n${tokenMigration}`;

  assert.equal(approvedSchema.includes('email_verified_at'), false);
  assert.match(
    service,
    /await db\.prepare\(\s*'UPDATE users SET email_verify_token = \?, email_verify_token_expires_at = \? WHERE id = \?'\s*\)\.run/
  );
  assert.match(
    service,
    /await db\.prepare\(\s*'UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_token_expires_at = NULL WHERE id = \?'\s*\)\.run/
  );
  assert.equal(
    service.includes('UPDATE users SET email_verified = 1, email_verified_at'),
    false
  );
});
