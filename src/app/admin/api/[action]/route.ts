import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth/email';
import { getCurrentUser } from '@/lib/auth/utils';
import {
  ADMIN_COOKIE, INITIAL_ADMIN_EMAIL, PBKDF2_ITERATIONS, adminCookieOptions, expiredAdminCookieOptions,
  hashPassword, hmacPseudonym, randomToken, sha256, timingSafeEqual, verifyPassword,
} from '@/lib/admin/security';
import {
  adminDb, audit, authenticateAdmin, clientIp, consumeLimit, createSession, requestIpHash,
} from '@/lib/admin/db';
import { sendAdminReset, sendAdminTransfer } from '@/lib/admin/email';
import {
  readJsonWithLimit, REQUEST_BODY_LIMITS, RequestBodyTooLargeError,
} from '@/lib/security/request-size';
import { getRuntimeString } from '@/lib/runtime/environment';

type Context = { params: Promise<{ action: string }> };
type PasswordRecord = {
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};
type AdminAccountRecord = PasswordRecord & {
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
};
type ResetRecord = { admin_id: string };
type TransferRecord = {
  from_admin_id: string;
  target_email: string;
  code_hash: string;
};
const genericLogin = { error: 'بيانات الدخول غير صحيحة أو تعذر إكمال الطلب' };

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', ...headers },
  });
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  const value = await readJsonWithLimit(request, REQUEST_BODY_LIMITS.auth);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid body');
  return value as Record<string, unknown>;
}

function boundedPassword(value: unknown): { value: string; acceptable: boolean } {
  const raw = typeof value === 'string' ? value : '';
  return {
    value: raw.length <= 200 ? raw : 'fixed-invalid-admin-password',
    acceptable: raw.length >= 14 && raw.length <= 200,
  };
}

async function currentAdmin() {
  const store = await cookies();
  return authenticateAdmin(store.get(ADMIN_COOKIE)?.value);
}

async function login(request: NextRequest) {
  const db = adminDb();
  const data = await body(request);
  const email = normalizeEmail(String(data.email ?? ''));
  const password = boundedPassword(data.password);
  const ip = clientIp(request);
  const [emailAllowed, ipAllowed] = await Promise.all([
    consumeLimit(db, `login:email:${email}`, 5, 15 * 60_000),
    consumeLimit(db, `login:ip:${ip}`, 20, 15 * 60_000),
  ]);
  if (!emailAllowed || !ipAllowed) return json(genericLogin, 429, { 'Retry-After': '900' });

  const account = await db.prepare(
    'SELECT id, email, role, password_hash, password_salt, password_iterations FROM admin_accounts WHERE email = ?'
  ).bind(email).first<AdminAccountRecord>();
  const derived = await hashPassword(
    password.value || 'fixed-invalid-admin-password',
    account?.password_salt || '00000000000000000000000000000000',
    account?.password_iterations || PBKDF2_ITERATIONS
  );
  const valid = timingSafeEqual(derived.hash, account?.password_hash || '0'.repeat(64));
  const ipHash = await requestIpHash(request);
  if (!password.acceptable || !valid || !account) {
    await audit(db, account?.id ?? null, 'login_failed', ipHash);
    return json(genericLogin, 401);
  }
  const session = await createSession(db, account.id);
  await audit(db, account.id, 'login_success', ipHash);
  const response = json({ success: true });
  response.cookies.set(ADMIN_COOKIE, session.token, adminCookieOptions(session.expiresAt));
  return response;
}

async function setup(request: NextRequest) {
  const data = await body(request);
  const password = boundedPassword(data.password);
  if (!password.acceptable) return json({ error: 'كلمة المرور يجب أن تكون 14 حرفاً على الأقل' }, 400);
  const user = await getCurrentUser();
  if (!user || user.email_verified !== 1 ||
      normalizeEmail(String(user.email ?? '')) !== INITIAL_ADMIN_EMAIL) {
    return json({ error: 'غير مصرح' }, 403);
  }
  const db = adminDb();
  const hashed = await hashPassword(password.value);
  const id = crypto.randomUUID();
  const now = Date.now();
  const inserted = await db.prepare(
    `INSERT INTO admin_accounts
     (id, email, password_hash, password_salt, password_iterations, role, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, 'super_admin', ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM admin_accounts) RETURNING id`
  ).bind(id, INITIAL_ADMIN_EMAIL, hashed.hash, hashed.salt, hashed.iterations, now, now).first();
  if (!inserted) return json({ error: 'تم إعداد بوابة الإدارة مسبقاً' }, 409);
  const session = await createSession(db, id);
  await audit(db, id, 'initial_setup', await requestIpHash(request));
  const response = json({ success: true });
  response.cookies.set(ADMIN_COOKIE, session.token, adminCookieOptions(session.expiresAt));
  return response;
}

async function portalData(admin: { id: string; email: string; role: string }) {
  const db = adminDb();
  if (admin.role !== 'super_admin') {
    return {
      admin, overview: {}, users: [], subscriptions: [], payments: [],
      connections: [], reports: [], audit: [],
    };
  }
  const [overview, users, subscriptions, payments, connections, reports, auditRows] = await Promise.all([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') active_subscriptions,
      (SELECT COALESCE(SUM(amountHalala),0) FROM payments WHERE status IN ('paid','captured','completed')) revenue_halala,
      (SELECT COUNT(*) FROM reports) reports`).first(),
    db.prepare(`SELECT id, email, plan, planExpiresAt, createdAt, free_reports_used, email_verified
      FROM users ORDER BY createdAt DESC LIMIT 200`).all(),
    db.prepare(`SELECT s.id, s.userId, u.email, s.planId, s.interval, s.status, s.startedAt, s.expiresAt, s.createdAt
      FROM subscriptions s LEFT JOIN users u ON u.id=s.userId ORDER BY s.createdAt DESC LIMIT 200`).all(),
    db.prepare(`SELECT p.id, p.userId, u.email, p.provider, p.amountHalala, p.currency, p.planId,
      p.interval, p.status, p.createdAt, p.updatedAt, p.processedAt
      FROM payments p LEFT JOIN users u ON u.id=p.userId ORDER BY p.createdAt DESC LIMIT 200`).all(),
    db.prepare(`SELECT c.id, c.userId, u.email, c.platform, c.status, c.storeName, c.storeUrl,
      c.tokenExpiresAt, c.createdAt FROM store_connections c LEFT JOIN users u ON u.id=c.userId
      ORDER BY c.createdAt DESC LIMIT 200`).all(),
    db.prepare(`SELECT r.id, r.userId, u.email, r.storeId, r.createdAt
      FROM reports r LEFT JOIN users u ON u.id=r.userId ORDER BY r.createdAt DESC LIMIT 200`).all(),
    db.prepare(`SELECT id, admin_id, action, target_type, target_id, metadata_json, created_at
      FROM admin_audit_log ORDER BY created_at DESC LIMIT 200`).all(),
  ]);
  return {
    admin, overview, users: users.results, subscriptions: subscriptions.results,
    payments: payments.results, connections: connections.results, reports: reports.results,
    audit: auditRows.results,
  };
}

async function changePassword(request: NextRequest, admin: { id: string }) {
  const data = await body(request);
  const current = boundedPassword(data.currentPassword);
  const next = boundedPassword(data.newPassword);
  if (!next.acceptable) return json({ error: 'كلمة المرور الجديدة يجب أن تكون 14 حرفاً على الأقل' }, 400);
  const db = adminDb();
  if (!await consumeLimit(db, `password-change:${admin.id}:${clientIp(request)}`, 6, 15 * 60_000)) {
    return json({ error: 'تعذر إكمال الطلب' }, 429, { 'Retry-After': '900' });
  }
  const account = await db.prepare(
    'SELECT password_hash, password_salt, password_iterations FROM admin_accounts WHERE id=?'
  ).bind(admin.id).first<PasswordRecord>();
  const currentValid = account
    ? await verifyPassword(current.value, account.password_hash, account.password_salt, account.password_iterations)
    : false;
  if (!account || !current.acceptable || !currentValid) {
    return json({ error: 'تعذر إكمال الطلب' }, 400);
  }
  const hashed = await hashPassword(next.value);
  await db.batch([
    db.prepare(`UPDATE admin_accounts SET password_hash=?, password_salt=?,
      password_iterations=?, updated_at=? WHERE id=?`)
      .bind(hashed.hash, hashed.salt, hashed.iterations, Date.now(), admin.id),
    db.prepare('DELETE FROM admin_sessions WHERE admin_id=?').bind(admin.id),
  ]);
  const session = await createSession(db, admin.id);
  await audit(db, admin.id, 'password_changed', await requestIpHash(request));
  const response = json({ success: true });
  response.cookies.set(ADMIN_COOKIE, session.token, adminCookieOptions(session.expiresAt));
  return response;
}

async function requestReset(request: NextRequest) {
  const data = await body(request);
  const email = normalizeEmail(String(data.email ?? ''));
  const db = adminDb();
  const [emailAllowed, ipAllowed] = await Promise.all([
    consumeLimit(db, `reset:email:${email}`, 3, 60 * 60_000),
    consumeLimit(db, `reset:ip:${clientIp(request)}`, 10, 60 * 60_000),
  ]);
  const account = emailAllowed && ipAllowed
    ? await db.prepare('SELECT id, email FROM admin_accounts WHERE email=?')
        .bind(email).first<{ id: string; email: string }>()
    : null;
  if (account) {
    const token = randomToken();
    await db.prepare(`INSERT INTO admin_password_resets
      (token_hash, admin_id, expires_at, consumed_at, created_at) VALUES (?, ?, ?, NULL, ?)`)
      .bind(await sha256(token), account.id, Date.now() + 30 * 60_000, Date.now()).run();
    try { await sendAdminReset(account.email, token); } catch { /* Generic response prevents discovery. */ }
    await audit(db, account.id, 'password_reset_requested', await requestIpHash(request));
  }
  return json({ success: true });
}

async function confirmReset(request: NextRequest) {
  const data = await body(request);
  const token = String(data.token ?? '');
  const password = boundedPassword(data.password);
  if (token.length !== 64 || !password.acceptable) return json({ error: 'الرابط غير صالح أو منتهي' }, 400);
  const db = adminDb();
  const tokenHash = await sha256(token);
  const claimHash = await sha256(randomToken());
  const now = Date.now();
  const reset = await db.prepare(
    `SELECT admin_id FROM admin_password_resets
     WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?`
  ).bind(tokenHash, now).first<ResetRecord>();
  if (!reset) return json({ error: 'الرابط غير صالح أو منتهي' }, 400);
  const hashed = await hashPassword(password.value);
  await db.batch([
    db.prepare(`UPDATE admin_password_resets SET consumed_at=?, claim_hash=?
      WHERE token_hash=? AND consumed_at IS NULL AND claim_hash IS NULL AND expires_at>?`)
      .bind(now, claimHash, tokenHash, now),
    db.prepare(`UPDATE admin_accounts SET password_hash=?, password_salt=?,
      password_iterations=?, updated_at=? WHERE id=? AND EXISTS
      (SELECT 1 FROM admin_password_resets WHERE token_hash=? AND claim_hash=?)`)
      .bind(hashed.hash, hashed.salt, hashed.iterations, now, reset.admin_id, tokenHash, claimHash),
    db.prepare(`DELETE FROM admin_sessions WHERE admin_id=? AND EXISTS
      (SELECT 1 FROM admin_password_resets WHERE token_hash=? AND claim_hash=?)`)
      .bind(reset.admin_id, tokenHash, claimHash),
  ]);
  const claimed = await db.prepare(
    'SELECT 1 ok FROM admin_password_resets WHERE token_hash=? AND claim_hash=?'
  ).bind(tokenHash, claimHash).first();
  if (!claimed) return json({ error: 'الرابط غير صالح أو منتهي' }, 400);
  await audit(db, reset.admin_id, 'password_reset_completed', await requestIpHash(request));
  return json({ success: true });
}

async function requestTransfer(request: NextRequest, admin: { id: string; role: string }) {
  if (admin.role !== 'super_admin') return json({ error: 'غير مصرح' }, 403);
  const data = await body(request);
  const password = boundedPassword(data.currentPassword);
  const targetEmail = normalizeEmail(String(data.targetEmail ?? ''));
  if (!targetEmail.includes('@') || targetEmail === INITIAL_ADMIN_EMAIL) return json({ error: 'البريد المستهدف غير صالح' }, 400);
  const db = adminDb();
  const [transferEmailAllowed, transferIpAllowed] = await Promise.all([
    consumeLimit(db, `transfer:email:${targetEmail}`, 3, 60 * 60_000),
    consumeLimit(db, `transfer:ip:${clientIp(request)}`, 10, 60 * 60_000),
  ]);
  if (!transferEmailAllowed || !transferIpAllowed) {
    return json({ error: 'تعذر إكمال الطلب' }, 429, { 'Retry-After': '900' });
  }
  const account = await db.prepare(
    'SELECT password_hash,password_salt,password_iterations FROM admin_accounts WHERE id=?'
  ).bind(admin.id).first<PasswordRecord>();
  const passwordValid = account
    ? await verifyPassword(password.value, account.password_hash, account.password_salt, account.password_iterations)
    : false;
  if (!account || !password.acceptable || !passwordValid) {
    return json({ error: 'تعذر إكمال الطلب' }, 400);
  }
  const token = randomToken();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM admin_transfer_requests WHERE from_admin_id=? AND consumed_at IS NULL').bind(admin.id),
    db.prepare(`INSERT INTO admin_transfer_requests
      (id,from_admin_id,target_email,token_hash,code_hash,expires_at,attempts,consumed_at,created_at)
      VALUES (?,?,?,?,?,?,0,NULL,?)`).bind(
        crypto.randomUUID(), admin.id, targetEmail, await sha256(token), await sha256(code),
        now + 30 * 60_000, now
      ),
  ]);
  await sendAdminTransfer(targetEmail, token, code);
  await audit(
    db, admin.id, 'transfer_requested', await requestIpHash(request),
    'email_pseudonym', await hmacPseudonym(`email:${targetEmail}`)
  );
  return json({ success: true });
}

async function confirmTransfer(request: NextRequest) {
  const data = await body(request);
  const token = String(data.token ?? '');
  const code = String(data.code ?? '');
  const password = boundedPassword(data.password);
  if (token.length !== 64 || !/^\d{6}$/.test(code) || !password.acceptable) {
    return json({ error: 'تعذر التحقق من الطلب' }, 400);
  }
  const db = adminDb();
  if (!await consumeLimit(db, `transfer-confirm:${clientIp(request)}`, 20, 15 * 60_000)) {
    return json({ error: 'تعذر التحقق من الطلب' }, 429, { 'Retry-After': '900' });
  }
  const tokenHash = await sha256(token);
  const transfer = await db.prepare(`SELECT * FROM admin_transfer_requests
    WHERE token_hash=? AND consumed_at IS NULL AND expires_at>? AND attempts<6`)
    .bind(tokenHash, Date.now()).first<TransferRecord>();
  if (!transfer || !timingSafeEqual(await sha256(code), transfer.code_hash)) {
    await db.prepare('UPDATE admin_transfer_requests SET attempts=attempts+1 WHERE token_hash=?')
      .bind(tokenHash).run();
    return json({ error: 'تعذر التحقق من الطلب' }, 400);
  }
  const transferEmailAllowed = await consumeLimit(
    db, `transfer-confirm:email:${transfer.target_email}`, 6, 15 * 60_000
  );
  if (!transferEmailAllowed) {
    return json({ error: 'تعذر التحقق من الطلب' }, 429, { 'Retry-After': '900' });
  }
  const hashed = await hashPassword(password.value);
  const targetId = crypto.randomUUID();
  const now = Date.now();
  const claimHash = await sha256(randomToken());
  await db.batch([
    db.prepare(`UPDATE admin_transfer_requests SET consumed_at=?, claim_hash=?
      WHERE token_hash=? AND code_hash=? AND consumed_at IS NULL AND claim_hash IS NULL
      AND expires_at>? AND attempts<6 AND EXISTS
      (SELECT 1 FROM admin_accounts WHERE id=from_admin_id AND role='super_admin')`)
      .bind(now, claimHash, tokenHash, await sha256(code), now),
    db.prepare(`UPDATE admin_accounts SET role='admin', updated_at=?
      WHERE id=? AND role='super_admin' AND EXISTS
      (SELECT 1 FROM admin_transfer_requests WHERE token_hash=? AND claim_hash=?)`)
      .bind(now, transfer.from_admin_id, tokenHash, claimHash),
    db.prepare(`INSERT INTO admin_accounts
      (id,email,password_hash,password_salt,password_iterations,role,created_at,updated_at)
      SELECT ?,?,?,?,?, 'super_admin',?,? WHERE EXISTS
      (SELECT 1 FROM admin_transfer_requests WHERE token_hash=? AND claim_hash=?)
      ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,
      password_salt=excluded.password_salt,password_iterations=excluded.password_iterations,
      role='super_admin',updated_at=excluded.updated_at`)
      .bind(targetId, transfer.target_email, hashed.hash, hashed.salt, hashed.iterations, now, now, tokenHash, claimHash),
    db.prepare(`DELETE FROM admin_sessions WHERE admin_id=? AND EXISTS
      (SELECT 1 FROM admin_transfer_requests WHERE token_hash=? AND claim_hash=?)`)
      .bind(transfer.from_admin_id, tokenHash, claimHash),
    db.prepare(`DELETE FROM admin_sessions WHERE admin_id IN
      (SELECT id FROM admin_accounts WHERE email=?) AND EXISTS
      (SELECT 1 FROM admin_transfer_requests WHERE token_hash=? AND claim_hash=?)`)
      .bind(transfer.target_email, tokenHash, claimHash),
  ]);
  const claimed = await db.prepare(
    `SELECT 1 ok FROM admin_transfer_requests t JOIN admin_accounts a
     ON a.email=t.target_email WHERE t.token_hash=? AND t.claim_hash=? AND a.role='super_admin'`
  ).bind(tokenHash, claimHash).first();
  if (!claimed) return json({ error: 'تعذر التحقق من الطلب' }, 400);
  await audit(
    db, transfer.from_admin_id, 'super_admin_transferred', await requestIpHash(request),
    'email_pseudonym', await hmacPseudonym(`email:${transfer.target_email}`)
  );
  return json({ success: true });
}

export async function GET(_request: NextRequest, context: Context) {
  const { action } = await context.params;
  try {
    const admin = await currentAdmin();
    if (action === 'status') {
      const count = await adminDb().prepare('SELECT COUNT(*) count FROM admin_accounts')
        .first<{ count: number }>();
      return json({ authenticated: Boolean(admin), setupAvailable: Number(count?.count ?? 0) === 0, admin });
    }
    if (!admin) return json({ error: 'غير مصرح' }, 401);
    if (action === 'data') return json(await portalData(admin));
    return json({ error: 'غير موجود' }, 404);
  } catch {
    if (action === 'status' && getRuntimeString('NODE_ENV') !== 'production') {
      return json({
        authenticated: false,
        setupAvailable: false,
        databaseUnavailable: true,
      });
    }
    return json({ error: 'تعذر إكمال الطلب' }, 500);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { action } = await context.params;
    if (action === 'login') return login(request);
    if (action === 'setup') return setup(request);
    if (action === 'request-reset') return requestReset(request);
    if (action === 'confirm-reset') return confirmReset(request);
    if (action === 'confirm-transfer') return confirmTransfer(request);
    const admin = await currentAdmin();
    if (!admin) return json({ error: 'غير مصرح' }, 401);
    if (action === 'logout') {
      await body(request);
      const store = await cookies();
      const token = store.get(ADMIN_COOKIE)?.value;
      if (token) await adminDb().prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256(token)).run();
      await audit(adminDb(), admin.id, 'logout', await requestIpHash(request));
      const response = json({ success: true });
      response.cookies.set(ADMIN_COOKIE, '', expiredAdminCookieOptions());
      return response;
    }
    if (action === 'change-password') return changePassword(request, admin);
    if (action === 'request-transfer') return requestTransfer(request, admin);
    return json({ error: 'غير موجود' }, 404);
  } catch (error) {
    return error instanceof RequestBodyTooLargeError
      ? json({ error: 'حجم الطلب كبير جداً' }, 413)
      : json({ error: 'تعذر إكمال الطلب' }, 400);
  }
}