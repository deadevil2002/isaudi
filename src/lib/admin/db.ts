import { getD1Database } from '@/lib/db/d1';
import { ADMIN_SESSION_MS, hmacPseudonym, randomToken, sha256 } from './security';
import { getRuntimeString } from '@/lib/runtime/environment';

type D1Statement = {
    bind(...values: unknown[]): D1Statement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    run(): Promise<unknown>;
};

export type D1 = {
  prepare(sql: string): D1Statement;
  batch(statements: unknown[]): Promise<unknown>;
};

export type Admin = { id: string; email: string; role: 'super_admin' | 'admin' };

export function adminDb(): D1 {
  const db = getD1Database() as D1 | null;
  if (!db) throw new Error('Database unavailable');
  return db;
}

export async function audit(
  db: D1,
  adminId: string | null,
  action: string,
  ipHash: string | null,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, string | number | boolean>
) {
  await db.prepare(
    `INSERT INTO admin_audit_log
     (id, admin_id, action, target_type, target_id, ip_hash, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), adminId, action, targetType ?? null, targetId ?? null, ipHash,
    metadata ? JSON.stringify(metadata) : null, Date.now()
  ).run();
}

export async function createSession(db: D1, adminId: string) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_MS;
  await db.batch([
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? OR expires_at <= ?').bind(adminId, now),
    db.prepare(
      `INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(tokenHash, adminId, expiresAt, now, now),
  ]);
  return { token, expiresAt };
}

export async function authenticateAdmin(token?: string | null): Promise<Admin | null> {
  if (!token || token.length !== 64) return null;
  const db = adminDb();
  const now = Date.now();
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT a.id, a.email, a.role FROM admin_sessions s
     JOIN admin_accounts a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(tokenHash, now).first<Admin>();
  if (!row) return null;
  await db.prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?')
    .bind(now, tokenHash).run();
  return row;
}

export async function consumeLimit(db: D1, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const start = Math.floor(now / windowMs) * windowMs;
  const keyHash = await hmacPseudonym(`limit:${key}`);
  await db.prepare('DELETE FROM admin_rate_limits WHERE expires_at <= ?').bind(now).run();
  const row = await db.prepare(
    `INSERT INTO admin_rate_limits (key_hash, window_start, expires_at, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1
     WHERE count < ? RETURNING count`
  ).bind(keyHash, start, start + windowMs, limit).first();
  return Boolean(row);
}

export function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (getRuntimeString('NODE_ENV') === 'production') return cloudflareIp || 'unavailable';
  return cloudflareIp ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function requestIpHash(request: Request): Promise<string> {
  return hmacPseudonym(`ip:${clientIp(request)}`);
}