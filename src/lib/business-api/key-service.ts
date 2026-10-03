import { randomBytes, randomUUID } from 'crypto';
import { limiterDigest } from '@/lib/auth/otp';
import { getRuntimeString } from '@/lib/runtime/environment';
import { BUSINESS_API_SCOPES, isBusinessApiScope, type BusinessApiScope } from './contracts';
import type { BusinessApiD1 } from './db';

export const BUSINESS_API_KEY_PREFIX = 'isaudi_api_';
export const BUSINESS_API_MAX_ACTIVE_KEYS = 3;

export type SafeBusinessApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: BusinessApiScope[];
  status: 'active' | 'revoked';
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  expiresAt: number | null;
};

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes_json: string;
  status: 'active' | 'revoked';
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
  expires_at: number | null;
};

function hmacSecret(): string {
  const value = getRuntimeString('OTP_HMAC_SECRET');
  if (!value) throw new Error('Business API credential hashing unavailable');
  return value;
}

function safeName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('invalid_name');
  }
  return name;
}

export function normalizeScopes(value: unknown): BusinessApiScope[] {
  if (!Array.isArray(value)) throw new Error('invalid_scopes');
  const scopes = Array.from(new Set(value));
  if (!scopes.length || scopes.length > BUSINESS_API_SCOPES.length || !scopes.every(isBusinessApiScope)) {
    throw new Error('invalid_scopes');
  }
  return scopes as BusinessApiScope[];
}

export function generateBusinessApiKey(): { plaintext: string; prefix: string; digest: string } {
  const plaintext = `${BUSINESS_API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    plaintext,
    prefix: `${BUSINESS_API_KEY_PREFIX}${plaintext.slice(BUSINESS_API_KEY_PREFIX.length, BUSINESS_API_KEY_PREFIX.length + 8)}`,
    digest: limiterDigest(`business-api-key:${plaintext}`, true, hmacSecret()),
  };
}

function safeKey(row: KeyRow): SafeBusinessApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    scopes: normalizeScopes(JSON.parse(row.scopes_json) as unknown),
    status: row.status,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
  };
}

export async function listBusinessApiKeys(db: BusinessApiD1, userId: string): Promise<SafeBusinessApiKey[]> {
  const result = await db.prepare(`SELECT id, name, key_prefix, scopes_json, status,
    created_at, last_used_at, revoked_at, expires_at
    FROM business_api_keys WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20`).bind(userId).all<KeyRow>();
  return result.results.map(safeKey);
}

export async function createBusinessApiKey(db: BusinessApiD1, input: {
  userId: string; name: unknown; scopes: unknown; now?: number; rotatedFromId?: string | null;
}): Promise<{ key: SafeBusinessApiKey; secret: string }> {
  const now = input.now ?? Date.now();
  const id = randomUUID();
  const eventId = randomUUID();
  const name = safeName(input.name);
  const scopes = normalizeScopes(input.scopes);
  const generated = generateBusinessApiKey();
  const active = await db.prepare(`SELECT COUNT(*) AS count FROM business_api_keys
    WHERE user_id = ? AND status = 'active'`).bind(input.userId).first<{ count: number }>();
  if (Number(active?.count ?? 0) >= BUSINESS_API_MAX_ACTIVE_KEYS) throw new Error('active_key_limit');
  await db.batch([
    db.prepare(`INSERT INTO business_api_keys (
      id, user_id, name, key_prefix, secret_hash, scopes_json, status,
      created_at, rotated_from_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`)
      .bind(id, input.userId, name, generated.prefix, generated.digest, JSON.stringify(scopes), now, input.rotatedFromId ?? null),
    db.prepare(`INSERT INTO business_api_key_events
      (id, user_id, key_id, event_type, created_at) VALUES (?, ?, ?, 'created', ?)`)
      .bind(eventId, input.userId, id, now),
  ]);
  return {
    key: { id, name, prefix: generated.prefix, scopes, status: 'active', createdAt: now, lastUsedAt: null, revokedAt: null, expiresAt: null },
    secret: generated.plaintext,
  };
}

export async function revokeBusinessApiKey(db: BusinessApiD1, userId: string, keyId: string, now = Date.now()): Promise<boolean> {
  const revoked = await db.prepare(`UPDATE business_api_keys SET status = 'revoked', revoked_at = ?
    WHERE id = ? AND user_id = ? AND status = 'active' RETURNING id`)
    .bind(now, keyId, userId).first<{ id: string }>();
  if (!revoked) return false;
  await db.prepare(`INSERT INTO business_api_key_events
    (id, user_id, key_id, event_type, created_at) VALUES (?, ?, ?, 'revoked', ?)`)
    .bind(randomUUID(), userId, keyId, now).run();
  return true;
}

export async function rotateBusinessApiKey(db: BusinessApiD1, input: {
  userId: string; keyId: string; now?: number;
}): Promise<{ key: SafeBusinessApiKey; secret: string } | null> {
  const current = await db.prepare(`SELECT id, name, scopes_json FROM business_api_keys
    WHERE id = ? AND user_id = ? AND status = 'active' LIMIT 1`)
    .bind(input.keyId, input.userId).first<{ id: string; name: string; scopes_json: string }>();
  if (!current) return null;
  const now = input.now ?? Date.now();
  const id = randomUUID();
  const scopes = normalizeScopes(JSON.parse(current.scopes_json) as unknown);
  const generated = generateBusinessApiKey();
  await db.batch([
    db.prepare(`UPDATE business_api_keys SET status = 'revoked', revoked_at = ?
      WHERE id = ? AND user_id = ? AND status = 'active'`).bind(now, current.id, input.userId),
    db.prepare(`INSERT INTO business_api_keys (
      id, user_id, name, key_prefix, secret_hash, scopes_json, status,
      created_at, rotated_from_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`)
      .bind(id, input.userId, current.name, generated.prefix, generated.digest, JSON.stringify(scopes), now, current.id),
    db.prepare(`INSERT INTO business_api_key_events
      (id, user_id, key_id, event_type, created_at) VALUES (?, ?, ?, 'rotated', ?)`)
      .bind(randomUUID(), input.userId, current.id, now),
  ]);
  return {
    key: { id, name: current.name, prefix: generated.prefix, scopes, status: 'active', createdAt: now, lastUsedAt: null, revokedAt: null, expiresAt: null },
    secret: generated.plaintext,
  };
}
