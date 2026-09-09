import { normalizeEmail } from '@/lib/auth/email';
import { getRuntimeString } from '@/lib/runtime/environment';

export const INITIAL_ADMIN_EMAIL = normalizeEmail('isaudi.official@gmail.com');
export const ADMIN_COOKIE = 'isaudi_admin_session';
export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
export const PBKDF2_ITERATIONS = 310_000;

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return new Uint8Array();
  const result = new Uint8Array(hex.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

export async function sha256(value: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function hmacPseudonym(value: string): Promise<string> {
  const configured = getRuntimeString('OTP_HMAC_SECRET');
  if (!configured && getRuntimeString('NODE_ENV') === 'production') {
    throw new Error('OTP_HMAC_SECRET is required in production');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(configured || 'development-only-auth-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`isaudi-admin-v1:${value}`))));
}

export async function hashPassword(
  password: string,
  salt = randomToken(16),
  iterations = PBKDF2_ITERATIONS
): Promise<{ hash: string; salt: string; iterations: number }> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt) as BufferSource, iterations },
    key,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt, iterations };
}

export function timingSafeEqual(left: string, right: string): boolean {
  const a = hexToBytes(left);
  const b = hexToBytes(right);
  const length = Math.max(a.length, b.length, 32);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyPassword(
  password: string,
  expected: string,
  salt: string,
  iterations: number
): Promise<boolean> {
  const actual = await hashPassword(password, salt, iterations);
  return timingSafeEqual(actual.hash, expected);
}

export function validPassword(password: string): boolean {
  return password.length >= 14 && password.length <= 200;
}

export function adminCookieOptions(expiresAt: number) {
  return {
    httpOnly: true as const,
    secure: true,
    sameSite: 'lax' as const,
    path: '/admin',
    expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  };
}

export function expiredAdminCookieOptions() {
  return { ...adminCookieOptions(0), maxAge: 0, expires: new Date(0) };
}