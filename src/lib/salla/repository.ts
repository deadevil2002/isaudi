import { getDb } from '@/lib/db/client';
import type {
  SallaAuthorizer,
  SallaConnection,
  SallaConnectState,
} from './types';

export const SALLA_AUTHORIZATION_UPSERT_SQL = `
  INSERT INTO salla_connections (
    merchantId, userId, status, accessTokenEncrypted, refreshTokenEncrypted,
    tokenExpiresAt, scopes, authorizerId, authorizerEmail, authorizerName,
    authorizerRole, authorizedAt, updatedAt, lastEventAt, lastEventType,
    lastEventPriority, tokenVersion
  ) VALUES (
    ?1,
    NULL, 'pending',
    ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
    'app.store.authorize', 10, 1
  )
  ON CONFLICT(merchantId) DO UPDATE SET
    userId = salla_connections.userId,
    status = CASE WHEN salla_connections.userId IS NULL
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

export async function createSallaLinkCode(input: {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: number;
  createdAt: number;
}): Promise<void> {
  const db = await getDb();
  await db.batch([
    {
      sql: `UPDATE salla_link_codes
        SET invalidatedAt = ?
        WHERE userId = ? AND consumedAt IS NULL AND invalidatedAt IS NULL`,
      params: [input.createdAt, input.userId],
    },
    {
      sql: `INSERT INTO salla_link_codes
        (id, userId, codeHash, expiresAt, consumedAt, invalidatedAt, createdAt)
        VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      params: [
        input.id,
        input.userId,
        input.codeHash,
        input.expiresAt,
        input.createdAt,
      ],
    },
  ]);
}

export async function getActiveSallaLinkCodeExpiry(
  userId: string,
  now = Date.now()
): Promise<number | null> {
  const db = await getDb();
  const row = await db.prepare(`
    SELECT expiresAt FROM salla_link_codes
    WHERE userId = ? AND consumedAt IS NULL AND invalidatedAt IS NULL
      AND expiresAt > ?
    ORDER BY createdAt DESC LIMIT 1
  `).get(userId, now);
  return row && typeof row.expiresAt === 'number' ? row.expiresAt : null;
}

export const SALLA_CLAIM_CONNECTION_SQL = `
  UPDATE salla_connections
  SET userId = ?1, status = 'connected', updatedAt = ?2
  WHERE merchantId = ?3
    AND userId IS NULL
    AND status = 'pending'
    AND accessTokenEncrypted IS NOT NULL
    AND refreshTokenEncrypted IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM salla_link_claims
      WHERE merchantId = ?3 AND userId = ?1 AND linkCodeId = ?4
    );
`;

export const SALLA_RECORD_CLAIM_SQL = `
  INSERT INTO salla_link_claims (merchantId, userId, linkCodeId, claimedAt)
  SELECT ?3, ?1, ?4, ?2
  FROM salla_connections AS connection
  JOIN salla_link_codes AS code
    ON code.id = ?4 AND code.userId = ?1 AND code.codeHash = ?5
  JOIN users AS claimant
    ON claimant.id = code.userId AND claimant.email_verified = 1
  WHERE connection.merchantId = ?3
    AND connection.userId IS NULL
    AND connection.status = 'pending'
    AND connection.accessTokenEncrypted IS NOT NULL
    AND connection.refreshTokenEncrypted IS NOT NULL
    AND code.consumedAt IS NULL
    AND code.invalidatedAt IS NULL
    AND code.expiresAt > ?2
    AND code.createdAt <= ?6
    AND ?6 >= COALESCE(connection.installedAt, 0)
    AND ?6 >= COALESCE(connection.appUpdatedAt, 0)
    AND ?6 >= COALESCE(connection.authorizedAt, 0)
    AND ?6 >= connection.lastEventAt
  ON CONFLICT DO NOTHING;
`;

export const SALLA_CONSUME_LINK_CODE_SQL = `
  UPDATE salla_link_codes
  SET consumedAt = ?2
  WHERE id = ?4 AND userId = ?1 AND codeHash = ?5
    AND consumedAt IS NULL AND invalidatedAt IS NULL AND expiresAt > ?2
    AND EXISTS (
      SELECT 1
      FROM salla_link_claims AS claim
      JOIN salla_connections AS connection
        ON connection.merchantId = claim.merchantId
      WHERE claim.merchantId = ?3
        AND claim.userId = ?1
        AND claim.linkCodeId = ?4
        AND claim.claimedAt = ?2
        AND connection.userId = ?1
        AND connection.status = 'connected'
    );
`;

export function buildSallaClaimBatch(input: {
  userId: string;
  now: number;
  merchantId: string;
  linkCodeId: string;
  codeHash: string;
  eventAt: number;
}): Array<{ sql: string; params: Array<string | number> }> {
  const params = [
    input.userId,
    input.now,
    input.merchantId,
    input.linkCodeId,
    input.codeHash,
    input.eventAt,
  ];
  return [
    { sql: SALLA_RECORD_CLAIM_SQL, params },
    { sql: SALLA_CLAIM_CONNECTION_SQL, params: params.slice(0, 4) },
    { sql: SALLA_CONSUME_LINK_CODE_SQL, params: params.slice(0, 5) },
  ];
}

export async function claimSallaMerchantByLinkCode(
  merchantId: string,
  codeHash: string,
  eventAt: number,
  now = Date.now()
): Promise<'claimed' | 'invalid' | 'conflict'> {
  const db = await getDb();
  const linkCode = await db.prepare(`
    SELECT id, userId FROM salla_link_codes
    WHERE codeHash = ? AND consumedAt IS NULL AND invalidatedAt IS NULL
      AND expiresAt > ?
    LIMIT 1
  `).get(codeHash, now);
  if (!linkCode?.id || !linkCode?.userId) return 'invalid';

  const operations = buildSallaClaimBatch({
    userId: String(linkCode.userId),
    now,
    merchantId,
    linkCodeId: String(linkCode.id),
    codeHash,
    eventAt,
  });
  await db.batch(operations);

  const consumed = await db.prepare(`
    SELECT id FROM salla_link_codes
    WHERE id = ? AND userId = ? AND consumedAt = ?
  `).get(linkCode.id, linkCode.userId, now);
  return consumed ? 'claimed' : 'conflict';
}

export const SALLA_ACQUIRE_REFRESH_SQL = `
  UPDATE salla_connections
  SET refreshState = 'in_progress',
    refreshAttemptId = ?1,
    refreshAttemptStartedAt = ?2,
    refreshLockToken = ?1,
    refreshLockExpiresAt = ?3
  WHERE merchantId = ?4 AND status = 'connected'
    AND userId IS NOT NULL
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
  userId: string
): Promise<SallaConnectState> {
  const owned = await getSallaConnectionForUser(userId);
  if (owned?.status === 'connected') {
    return getOwnedSallaConnectState(owned);
  }
  if (owned?.status === 'disconnected' || owned?.status === 'uninstalled') {
    return 'disconnected';
  }
  return await getActiveSallaLinkCodeExpiry(userId)
    ? 'waiting_for_link'
    : 'before_install';
}