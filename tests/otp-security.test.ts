import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOtpChallenge,
  genericOtpResponse,
  hashesEqual,
  isRateLimitReached,
  otpDigest,
  OTP_LIMITS,
  OTP_WINDOW_MS,
  retryAfter,
} from '../src/lib/auth/otp';

test('OTP digest is not the raw code and is bound to normalized email', () => {
  const email = 'user@example.com';
  const digest = otpDigest(email, '123456', true, 'production-test-secret');
  assert.notEqual(digest, '123456');
  assert.notEqual(digest, otpDigest('other@example.com', '123456', true, 'production-test-secret'));
  assert.equal(hashesEqual(digest, otpDigest(email, '123456', true, 'production-test-secret')), true);
  assert.equal(hashesEqual(digest, otpDigest(email, '654321', true, 'production-test-secret')), false);
});

test('valid OTP succeeds while wrong, expired, consumed, and reused OTPs fail', () => {
  const email = 'user@example.com';
  const secret = 'production-test-secret';
  const now = 1_000_000;
  const challenge = {
    otp_hash: otpDigest(email, '123456', true, secret),
    attempts: 0,
    expires_at: now + 60_000,
    consumed_at: null,
  };

  assert.equal(evaluateOtpChallenge(challenge, email, '123456', now, true, secret).valid, true);
  assert.equal(evaluateOtpChallenge(challenge, email, '654321', now, true, secret).valid, false);
  assert.equal(
    evaluateOtpChallenge({ ...challenge, expires_at: now }, email, '123456', now, true, secret).valid,
    false
  );
  assert.equal(
    evaluateOtpChallenge({ ...challenge, consumed_at: now - 1 }, email, '123456', now, true, secret).valid,
    false
  );
  assert.equal(
    evaluateOtpChallenge(
      { ...challenge, attempts: OTP_LIMITS.verifyEmail },
      email,
      '123456',
      now,
      true,
      secret
    ).valid,
    false
  );
  assert.deepEqual(genericOtpResponse(), { error: 'Invalid or expired code' });
});

test('request and failed-verification thresholds trigger at their configured limits', () => {
  assert.equal(isRateLimitReached(OTP_LIMITS.requestEmail - 1, OTP_LIMITS.requestEmail), false);
  assert.equal(isRateLimitReached(OTP_LIMITS.requestEmail, OTP_LIMITS.requestEmail), true);
  assert.equal(isRateLimitReached(OTP_LIMITS.requestIp, OTP_LIMITS.requestIp), true);
  assert.equal(isRateLimitReached(OTP_LIMITS.verifyEmail, OTP_LIMITS.verifyEmail), true);
  assert.equal(isRateLimitReached(OTP_LIMITS.verifyIp, OTP_LIMITS.verifyIp), true);
});

test('fixed-window counters reset at the next boundary', () => {
  const start = 15 * 60 * 1000;
  assert.equal(retryAfter(start, start), 900);
  const nextWindowStart = Math.floor((start + OTP_WINDOW_MS) / OTP_WINDOW_MS) * OTP_WINDOW_MS;
  assert.equal(nextWindowStart, start + OTP_WINDOW_MS);
  assert.equal(isRateLimitReached(0, OTP_LIMITS.requestEmail), false);
});