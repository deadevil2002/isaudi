import { createHmac, timingSafeEqual } from 'crypto';

const DOMAIN = 'isaudi-otp-v2';
const WINDOW_MS = 15 * 60 * 1000;

function secret(required = process.env.NODE_ENV === 'production', supplied?: string): string {
  const value = (supplied || process.env.OTP_HMAC_SECRET || '').trim();
  if (!value && required) throw new Error('OTP_HMAC_SECRET is required in production');
  return value || 'development-only-auth-secret';
}

export function otpDigest(email: string, code: string, required = process.env.NODE_ENV === 'production', hmacSecret?: string): string {
  return createHmac('sha256', secret(required, hmacSecret)).update(`${DOMAIN}:code:${email}:${code}`).digest('hex');
}

export function limiterDigest(value: string, required = process.env.NODE_ENV === 'production', hmacSecret?: string): string {
  return createHmac('sha256', secret(required, hmacSecret)).update(`${DOMAIN}:limit:${value}`).digest('hex');
}

export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export type OTPChallengeLike = {
  otp_hash: string;
  attempts: number;
  expires_at: number;
  consumed_at?: number | null;
};

export function evaluateOtpChallenge(
  challenge: OTPChallengeLike | null | undefined,
  email: string,
  code: string,
  now: number,
  required = process.env.NODE_ENV === 'production',
  hmacSecret?: string
): { valid: boolean; digest: string } {
  const digest = otpDigest(email, code, required, hmacSecret);
  const valid = Boolean(
    challenge &&
      challenge.expires_at > now &&
      !challenge.consumed_at &&
      challenge.attempts < OTP_LIMITS.verifyEmail &&
      hashesEqual(digest, challenge.otp_hash)
  );
  return { valid, digest };
}

export function isRateLimitReached(count: number, limit: number): boolean {
  return count >= limit;
}

export const OTP_WINDOW_MS = WINDOW_MS;
export const OTP_LIMITS = { requestEmail: 5, requestIp: 10, verifyEmail: 8, verifyIp: 20 };

export function genericOtpResponse() {
  return { error: 'Invalid or expired code' };
}

export function retryAfter(windowStart: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
}