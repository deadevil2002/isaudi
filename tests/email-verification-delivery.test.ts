import assert from 'node:assert/strict';
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
