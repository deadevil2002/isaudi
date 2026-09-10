import { getDb } from '@/lib/db/client';
import { normalizeEmail } from '@/lib/auth/email';
import type { SallaAuthorizer, SallaConnection } from './types';

type UnknownRow = Record<string, unknown>;

function isRow(value: unknown): value is UnknownRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rows(result: unknown): UnknownRow[] {
  if (Array.isArray(result)) return result.filter(isRow);
  if (isRow(result) && Array.isArray(result.results)) {
    return result.results.filter(isRow);
  }
  return [];
}

export async function findVerifiedUserForAuthorizer(
  email: string
): Promise<string | null> {
  const db = await getDb();
  const result = await db
    .prepare('SELECT id, email FROM users WHERE email_verified = 1')
    .all();
  const normalized = normalizeEmail(email);
  const matches = rows(result).filter(
    (user) => typeof user.email === 'string' && normalizeEmail(user.email) === normalized
  );
  return matches.length === 1 ? String(matches[0].id) : null;
}

export const SALLA_AUTHORIZATION_UPSERT_SQL = `
  INSERT INTO salla_connections (
    merchantId, userId, status, accessTokenEncrypted, refreshTokenEncrypted,
    tokenExpiresAt, scopes, authorizerId, authorizerEmail, authorizerName,
    authorizerRole, authorizedAt, updatedAt, lastEventAt, lastEventType,
    lastEventPriority, tokenVersion
  ) VALUES (
    ?1,
    CASE WHEN ?2 IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM salla_connections
      WHERE userId = ?2 AND merchantId <> ?1
    ) THEN ?2 ELSE NULL END,
    CASE WHEN ?2 IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM salla_connections
      WHERE userId = ?2 AND merchantId <> ?1
    ) THEN 'connected' ELSE 'pending' END,
    ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
    'app.store.authorize', 10, 1
  )
  ON CONFLICT(merchantId) DO UPDATE SET
    userId = COALESCE(
      salla_connections.userId,
      CASE WHEN excluded.userId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM salla_connections AS owned
        WHERE owned.userId = excluded.userId
          AND owned.merchantId <> excluded.merchantId
      ) THEN excluded.userId ELSE NULL END
    ),
    status = CASE WHEN COALESCE(salla_connections.userId, excluded.userId) IS NULL
      THEN 'pending' ELSE 'connected' END,
    accessTokenEncrypted = excluded.accessTokenEncrypted,
    refreshTokenEncrypted = excluded.refreshTokenEncrypted,
    tokenExpiresAt = excluded.tokenExpiresAt,
    scopes = excluded.scopes,
    authorizerId = excluded.authorizerId,
    authorizerEmail = excluded.authorizerEmail,
    authorizerName = excluded.authorizerName,
    authorizerRole = excluded.authorizerRole,
    authorizedAt = excluded.authorizedAt,
    updatedAt = excluded.updatedAt,
    lastEventAt = excluded.lastEventAt,
    lastEventType = excluded.lastEventType,
    lastEventPriority = excluded.lastEventPriority,
    tokenVersion = salla_connections.tokenVersion + 1,
    refreshState = 'idle',
    refreshAttemptId = NULL,
    refreshAttemptStartedAt = NULL,
    refreshLockToken = NULL,
    refreshLockExpiresAt = NULL
  WHERE excluded.lastEventAt > salla_connections.lastEventAt
    OR (
      excluded.lastEventAt = salla_connections.lastEventAt
      AND excluded.lastEventPriority > salla_connections.lastEventPriority
    );
`;

export async function upsertSallaAuthorization(input: {
  merchantId: string;
  candidateUserId: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: number;
  scopes: string;
  authorizer: SallaAuthorizer;
  eventAt: number;
}): Promise<void> {
  const db = await getDb();
  await db.prepare(SALLA_AUTHORIZATION_UPSERT_SQL).run(
    input.merchantId,
    input.candidateUserId,
    input.accessTokenEncrypted,
    input.refreshTokenEncrypted,
    input.tokenExpiresAt,
    input.scopes,
    input.authorizer.id,
    input.authorizer.email,
    input.authorizer.name,
    input.authorizer.role,
    input.eventAt,
    Date.now(),
    input.eventAt
  );
}

export const SALLA_TERMINAL_UPSERT_SQL = `
  INSERT INTO salla_connections (
    merchantId, status, updatedAt, lastEventAt, lastEventType,
    lastEventPriority, uninstalledAt, disconnectedAt
  )
  VALUES (?1, ?2, ?3, ?4, ?5, 100, ?6, ?7)
  ON CONFLICT(merchantId) DO UPDATE SET
    status = excluded.status,
    accessTokenEncrypted = NULL,
    refreshTokenEncrypted = NULL,
    tokenExpiresAt = NULL,
    uninstalledAt = excluded.uninstalledAt,
    disconnectedAt = excluded.disconnectedAt,
    updatedAt = excluded.updatedAt,
    lastEventAt = excluded.lastEventAt,
    lastEventType = excluded.lastEventType,
    lastEventPriority = excluded.lastEventPriority,
    tokenVersion = salla_connections.tokenVersion + 1,
    refreshState = 'idle',
    refreshAttemptId = NULL,
    refreshAttemptStartedAt = NULL,
    refreshLockToken = NULL,
    refreshLockExpiresAt = NULL
  WHERE excluded.lastEventAt > salla_connections.lastEventAt
    OR (
      excluded.lastEventAt = salla_connections.lastEventAt
      AND excluded.lastEventPriority > salla_connections.lastEventPriority
    );
`;

export const SALLA_INFORMATIONAL_UPSERT_SQL = `
  INSERT INTO salla_connections (
    merchantId, status, updatedAt, installedAt, appUpdatedAt
  )
  VALUES (?1, 'pending', ?2, ?3, ?4)
  ON CONFLICT(merchantId) DO UPDATE SET
    installedAt = COALESCE(salla_connections.installedAt, excluded.installedAt),
    appUpdatedAt = CASE
      WHEN excluded.appUpdatedAt IS NULL THEN salla_connections.appUpdatedAt
      WHEN salla_connections.appUpdatedAt IS NULL THEN excluded.appUpdatedAt
      ELSE MAX(salla_connections.appUpdatedAt, excluded.appUpdatedAt)
    END,
    updatedAt = MAX(salla_connections.updatedAt, excluded.updatedAt);
`;

export async function applySallaLifecycle(
  merchantId: string,
  event: 'app.installed' | 'app.updated' | 'app.uninstalled' | 'app.store.deauthorize',
  eventAt: number
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  if (event === 'app.uninstalled' || event === 'app.store.deauthorize') {
    const status = event === 'app.uninstalled' ? 'uninstalled' : 'disconnected';
    await db.prepare(SALLA_TERMINAL_UPSERT_SQL).run(
      merchantId, status, now, eventAt, event,
      event === 'app.uninstalled' ? eventAt : null,
      eventAt
    );
    return;
  }

  await db.prepare(SALLA_INFORMATIONAL_UPSERT_SQL).run(
    merchantId,
    now,
    event === 'app.installed' ? eventAt : null,
    event === 'app.updated' ? eventAt : null
  );
}

export async function getSallaConnectionByMerchant(
  merchantId: string
): Promise<SallaConnection | undefined> {
  const db = await getDb();
  return db.prepare('SELECT * FROM salla_connections WHERE merchantId = ?').get(merchantId);
}

export const SALLA_ACQUIRE_REFRESH_SQL = `
  UPDATE salla_connections
  SET refreshState = 'in_progress',
    refreshAttemptId = ?1,
    refreshAttemptStartedAt = ?2,
    refreshLockToken = ?1,
    refreshLockExpiresAt = ?3
  WHERE merchantId = ?4 AND status = 'connected'
    AND refreshTokenEncrypted IS NOT NULL
    AND refreshState = 'idle'
    AND (refreshLockToken IS NULL OR refreshLockExpiresAt <= ?2)
  RETURNING *;
`;

export async function acquireSallaRefreshLock(
  merchantId: string,
  lockToken: string,
  now: number,
  leaseMs: number
): Promise<SallaConnection | undefined> {
  const db = await getDb();
  return db.prepare(SALLA_ACQUIRE_REFRESH_SQL).get(
    lockToken,
    now,
    now + leaseMs,
    merchantId
  );
}

export const SALLA_COMMIT_REFRESH_SQL = `
  UPDATE salla_connections
  SET accessTokenEncrypted = ?1,
    refreshTokenEncrypted = ?2,
    tokenExpiresAt = ?3,
    scopes = COALESCE(?4, scopes),
    tokenVersion = tokenVersion + 1,
    updatedAt = ?5,
    refreshState = 'idle',
    refreshAttemptStartedAt = NULL,
    refreshLockToken = NULL,
    refreshLockExpiresAt = NULL
  WHERE merchantId = ?6 AND status = 'connected'
    AND refreshState = 'in_progress'
    AND refreshAttemptId = ?7
    AND refreshLockToken = ?7
    AND tokenVersion = ?8
  RETURNING merchantId;
`;

export async function commitSallaTokenRefresh(input: {
  merchantId: string;
  lockToken: string;
  expectedVersion: number;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: number;
  scopes: string | null;
}): Promise<boolean> {
  const db = await getDb();
  const row = await db.prepare(SALLA_COMMIT_REFRESH_SQL).get(
    input.accessTokenEncrypted,
    input.refreshTokenEncrypted,
    input.tokenExpiresAt,
    input.scopes,
    Date.now(),
    input.merchantId,
    input.lockToken,
    input.expectedVersion
  );
  return Boolean(row);
}

export async function releaseSallaRefreshAttemptBeforeRequest(
  merchantId: string,
  lockToken: string,
  expectedVersion: number
): Promise<void> {
  const db = await getDb();
  await db.prepare(`
    UPDATE salla_connections
    SET refreshState = 'idle',
      refreshAttemptId = NULL,
      refreshAttemptStartedAt = NULL,
      refreshLockToken = NULL,
      refreshLockExpiresAt = NULL
    WHERE merchantId = ? AND refreshState = 'in_progress'
      AND refreshAttemptId = ? AND tokenVersion = ?
  `).run(merchantId, lockToken, expectedVersion);
}

export const SALLA_MARK_REFRESH_UNCERTAIN_SQL = `
  UPDATE salla_connections
  SET refreshState = 'uncertain',
    refreshLockToken = NULL,
    refreshLockExpiresAt = NULL
  WHERE merchantId = ?1 AND refreshState = 'in_progress'
    AND refreshAttemptId = ?2 AND tokenVersion = ?3;
`;

export async function markSallaRefreshUncertain(
  merchantId: string,
  lockToken: string,
  expectedVersion: number
): Promise<void> {
  const db = await getDb();
  await db.prepare(SALLA_MARK_REFRESH_UNCERTAIN_SQL).run(
    merchantId,
    lockToken,
    expectedVersion
  );
}

export async function getSallaConnectionForUser(
  userId: string
): Promise<SallaConnection | undefined> {
  const db = await getDb();
  return db.prepare(`
    SELECT * FROM salla_connections
    WHERE userId = ?
    ORDER BY CASE status WHEN 'connected' THEN 0 ELSE 1 END, updatedAt DESC LIMIT 1
  `).get(userId);
}

export function sallaRefreshNeedsReconnect(
  connection: SallaConnection,
  now = Date.now()
): boolean {
  if (connection.refreshState === 'uncertain') return true;
  if (connection.refreshState !== 'in_progress') return false;
  return !connection.refreshAttemptId ||
    !connection.refreshAttemptStartedAt ||
    !connection.refreshLockExpiresAt ||
    connection.refreshLockExpiresAt <= now;
}

export function getOwnedSallaConnectState(
  connection: SallaConnection,
  now = Date.now()
): 'reconnect_required' | 'connected' {
  return sallaRefreshNeedsReconnect(connection, now)
    ? 'reconnect_required'
    : 'connected';
}

export async function getSallaConnectState(
  userId: string,
  userEmail: string
): Promise<'before_install' | 'pending' | 'reconnect_required' | 'connected'> {
  const owned = await getSallaConnectionForUser(userId);
  if (owned?.status === 'connected') {
    return getOwnedSallaConnectState(owned);
  }
  const db = await getDb();
  const result = await db.prepare(`
    SELECT authorizerEmail FROM salla_connections
    WHERE userId IS NULL AND status = 'pending'
  `).all();
  const email = normalizeEmail(userEmail);
  return rows(result).some(
    (row) => typeof row.authorizerEmail === 'string' &&
      normalizeEmail(row.authorizerEmail) === email
  ) ? 'pending' : 'before_install';
}