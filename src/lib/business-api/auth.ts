import { limiterDigest } from '@/lib/auth/otp';
import { getRuntimeString } from '@/lib/runtime/environment';
import { getUserEntitlements } from '@/lib/subscription/service';
import {
  BUSINESS_API_RATE_LIMIT,
  apiError,
  parseScopes,
  type BusinessApiScope,
} from './contracts';
import type { BusinessApiD1 } from './db';

export type AuthenticatedBusinessApiKey = {
  keyId: string;
  userId: string;
  prefix: string;
  scopes: BusinessApiScope[];
};

type KeyRow = {
  id: string;
  user_id: string;
  key_prefix: string;
  scopes_json: string;
  status: string;
  expires_at: number | null;
};

function credentialDigest(plaintext: string): string {
  const hmacSecret = getRuntimeString('OTP_HMAC_SECRET');
  if (!hmacSecret) throw new Error('Business API credential hashing unavailable');
  return limiterDigest(`business-api-key:${plaintext}`, true, hmacSecret);
}

function authorizationToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
  return match?.[1] ?? null;
}

async function consumeLimit(db: BusinessApiD1, key: string, limit: number, now: number) {
  const hmacSecret = getRuntimeString('OTP_HMAC_SECRET');
  if (!hmacSecret) throw new Error('Business API rate limiting unavailable');
  const windowStart = Math.floor(now / BUSINESS_API_RATE_LIMIT.windowMs) * BUSINESS_API_RATE_LIMIT.windowMs;
  const digest = limiterDigest(`business-api-rate:${key}`, true, hmacSecret);
  const row = await db.prepare(`INSERT INTO otp_rate_limits (key_hash, window_start, expires_at, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1
    WHERE count < ? RETURNING count`).bind(
      digest, windowStart, windowStart + BUSINESS_API_RATE_LIMIT.windowMs, limit,
    ).first<{ count: number }>();
  return {
    allowed: Boolean(row),
    retryAfter: Math.max(1, Math.ceil((windowStart + BUSINESS_API_RATE_LIMIT.windowMs - now) / 1000)),
  };
}

export async function authenticateBusinessApiRequest(input: {
  request: Request;
  db: BusinessApiD1;
  requiredScope: BusinessApiScope;
  now?: number;
  getEntitlements?: typeof getUserEntitlements;
}): Promise<{ auth: AuthenticatedBusinessApiKey } | { response: Response; auth?: AuthenticatedBusinessApiKey }> {
  const url = new URL(input.request.url);
  if (url.searchParams.has('api_key') || url.searchParams.has('key')) {
    return { response: apiError('invalid_request', 'API keys are accepted only in the Authorization header.', 400) };
  }
  const plaintext = authorizationToken(input.request);
  if (!plaintext || !plaintext.startsWith('isaudi_api_')) {
    return { response: apiError('invalid_api_key', 'A valid Bearer API key is required.', 401) };
  }
  let digest: string;
  try {
    digest = credentialDigest(plaintext);
  } catch {
    return { response: apiError('service_unavailable', 'API authentication is temporarily unavailable.', 503) };
  }
  const now = input.now ?? Date.now();
  const row = await input.db.prepare(`SELECT id, user_id, key_prefix, scopes_json, status, expires_at
    FROM business_api_keys WHERE secret_hash = ? LIMIT 1`).bind(digest).first<KeyRow>();
  if (!row || row.status !== 'active' || (row.expires_at !== null && row.expires_at <= now)) {
    return { response: apiError('invalid_api_key', 'The API key is invalid, expired, or revoked.', 401) };
  }
  const scopes = parseScopes(row.scopes_json);
  const auth = { keyId: row.id, userId: row.user_id, prefix: row.key_prefix, scopes };
  const entitlements = await (input.getEntitlements ?? getUserEntitlements)(row.user_id);
  if (!entitlements.isActiveNow || !entitlements.limits.apiAccess) {
    return { response: apiError('api_access_not_entitled', 'An active Business subscription is required.', 403), auth };
  }
  if (!scopes.includes(input.requiredScope)) {
    return { response: apiError('insufficient_scope', `The ${input.requiredScope} scope is required.`, 403), auth };
  }
  const keyLimit = await consumeLimit(input.db, `key:${row.id}`, BUSINESS_API_RATE_LIMIT.key, now);
  if (!keyLimit.allowed) {
    return { response: apiError('rate_limit_exceeded', 'The provisional API rate limit was exceeded.', 429, { 'Retry-After': String(keyLimit.retryAfter) }), auth };
  }
  const tenantLimit = await consumeLimit(input.db, `tenant:${row.user_id}`, BUSINESS_API_RATE_LIMIT.tenant, now);
  if (!tenantLimit.allowed) {
    return { response: apiError('rate_limit_exceeded', 'The provisional tenant rate limit was exceeded.', 429, { 'Retry-After': String(tenantLimit.retryAfter) }), auth };
  }
  return { auth };
}

export async function recordBusinessApiUsage(input: {
  db: BusinessApiD1;
  auth: AuthenticatedBusinessApiKey;
  endpoint: string;
  status: number;
  latencyMs: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const success = input.status >= 200 && input.status < 400 ? 1 : 0;
  const error = input.status >= 400 ? 1 : 0;
  const limited = input.status === 429 ? 1 : 0;
  await input.db.batch([
    input.db.prepare(`UPDATE business_api_keys SET last_used_at = ?, request_count = request_count + 1,
      error_count = error_count + ?, rate_limit_count = rate_limit_count + ? WHERE id = ?`).bind(now, error, limited, input.auth.keyId),
    input.db.prepare(`INSERT INTO business_api_usage_daily (
      day_start, key_id, endpoint, request_count, success_count, error_count,
      rate_limit_count, latency_total_ms, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(day_start, key_id, endpoint) DO UPDATE SET
      request_count = request_count + 1,
      success_count = success_count + excluded.success_count,
      error_count = error_count + excluded.error_count,
      rate_limit_count = rate_limit_count + excluded.rate_limit_count,
      latency_total_ms = latency_total_ms + excluded.latency_total_ms,
      updated_at = excluded.updated_at`).bind(
        dayStart, input.auth.keyId, input.endpoint, success, error, limited,
        Math.max(0, Math.round(input.latencyMs)), now,
      ),
    input.db.prepare(`UPDATE business_api_admin_summary SET
      request_count = request_count + 1,
      error_count = error_count + ?,
      rate_limit_count = rate_limit_count + ?,
      last_used_at = ?, updated_at = ? WHERE id = 1`)
      .bind(error, limited, now, now),
  ]);
}
