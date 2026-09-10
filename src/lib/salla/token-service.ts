import { randomUUID } from 'crypto';
import { getSallaEnvironment } from './environment';
import { SALLA_TOKEN_URL } from './constants';
import { decryptSallaToken, encryptSallaToken } from './token-crypto';
import {
  acquireSallaRefreshLock,
  commitSallaTokenRefresh,
  getSallaConnectionByMerchant,
  getSallaConnectionForUser,
  markSallaRefreshUncertain,
  releaseSallaRefreshAttemptBeforeRequest,
} from './repository';
import type { SallaConnection } from './types';

const EXPIRY_SKEW_MS = 60_000;
const REFRESH_LEASE_MS = 30_000;
const REFRESH_WAIT_MS = 22_000;
const REFRESH_POLL_MS = 200;
const REFRESH_FETCH_TIMEOUT_MS = 20_000;

export class SallaTokenUnavailableError extends Error {
  constructor() {
    super('Salla access token is unavailable');
    this.name = 'SallaTokenUnavailableError';
  }
}

function usable(connection: SallaConnection, now: number): boolean {
  return connection.status === 'connected' &&
    Boolean(connection.userId) &&
    Boolean(connection.accessTokenEncrypted) &&
    connection.refreshState !== 'uncertain' &&
    Boolean(connection.tokenExpiresAt && connection.tokenExpiresAt > now + EXPIRY_SKEW_MS);
}

export async function refreshSallaToken(
  connection: SallaConnection,
  fetcher: typeof fetch,
  now: number,
  dependencies: {
    acquireLock?: typeof acquireSallaRefreshLock;
    commitRefresh?: typeof commitSallaTokenRefresh;
    releaseLock?: typeof releaseSallaRefreshAttemptBeforeRequest;
    markUncertain?: typeof markSallaRefreshUncertain;
    environment?: typeof getSallaEnvironment;
    decryptToken?: typeof decryptSallaToken;
    encryptToken?: typeof encryptSallaToken;
    createLockToken?: () => string;
    getConnection?: typeof getSallaConnectionByMerchant;
    wait?: (milliseconds: number) => Promise<void>;
    fetchTimeoutMs?: number;
    /**
     * When a provider rejected this exact access token, a still-unexpired
     * token must not be reused.  The comparison is made while holding the
     * persisted refresh lock so a concurrent loser can safely use the
     * winner's newer token without rotating again.
     */
    rejectedAccessToken?: string;
  } = {}
): Promise<string> {
  if (connection.status !== 'connected' || !connection.userId) {
    throw new SallaTokenUnavailableError();
  }
  const lockToken = (dependencies.createLockToken || randomUUID)();
  const locked = await (dependencies.acquireLock || acquireSallaRefreshLock)(
    connection.merchantId,
    lockToken,
    now,
    REFRESH_LEASE_MS
  );
  if (!locked) {
    const getConnection = dependencies.getConnection || getSallaConnectionByMerchant;
    const wait = dependencies.wait ||
      ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const deadline = Date.now() + REFRESH_WAIT_MS;
    while (Date.now() < deadline) {
      await wait(REFRESH_POLL_MS);
      const current = await getConnection(connection.merchantId);
      let currentTokenWasRejected = false;
      if (dependencies.rejectedAccessToken && current?.accessTokenEncrypted) {
        try {
          currentTokenWasRejected =
            (dependencies.decryptToken || decryptSallaToken)(
              current.accessTokenEncrypted
            ) === dependencies.rejectedAccessToken;
        } catch {
          // An unreadable ciphertext is not a reusable winner.
        }
      }
      if (current && usable(current, Date.now()) && !currentTokenWasRejected) {
        return (dependencies.decryptToken || decryptSallaToken)(
          current.accessTokenEncrypted!
        );
      }
      if (!current || current.status !== 'connected' || !current.refreshLockToken) break;
    }
    throw new SallaTokenUnavailableError();
  }

  let providerRequestStarted = false;
  try {
    const decryptToken = dependencies.decryptToken || decryptSallaToken;
    let lockedTokenWasRejected = false;
    if (dependencies.rejectedAccessToken && locked.accessTokenEncrypted) {
      try {
        lockedTokenWasRejected =
          decryptToken(locked.accessTokenEncrypted) === dependencies.rejectedAccessToken;
      } catch {
        // A ciphertext that cannot be inspected cannot be safely reused for a
        // provider rejection; continue through the existing fail-closed path.
      }
    }
    if (usable(locked, Date.now()) && !lockedTokenWasRejected) {
      await (dependencies.releaseLock || releaseSallaRefreshAttemptBeforeRequest)(
        connection.merchantId,
        lockToken,
        locked.tokenVersion
      );
      return decryptToken(locked.accessTokenEncrypted!);
    }
    const { SALLA_CLIENT_ID, SALLA_CLIENT_SECRET } =
      (dependencies.environment || getSallaEnvironment)();
    if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET || !locked.refreshTokenEncrypted) {
      throw new SallaTokenUnavailableError();
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(locked.refreshTokenEncrypted),
      client_id: SALLA_CLIENT_ID,
      client_secret: SALLA_CLIENT_SECRET,
    });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      dependencies.fetchTimeoutMs ?? REFRESH_FETCH_TIMEOUT_MS
    );
    let response: Response;
    let json: Record<string, unknown>;
    try {
      providerRequestStarted = true;
      response = await fetcher(SALLA_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      json = await response.json() as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }
    const accessToken = typeof json.access_token === 'string' && json.access_token
      ? json.access_token : null;
    const refreshToken = typeof json.refresh_token === 'string' && json.refresh_token
      ? json.refresh_token : null;
    const expiresIn = typeof json.expires_in === 'number'
      ? json.expires_in : Number(json.expires_in);
    if (!response.ok || !accessToken || !refreshToken ||
        !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new SallaTokenUnavailableError();
    }
    const encryptToken = dependencies.encryptToken || encryptSallaToken;
    const commitInput = {
      merchantId: locked.merchantId,
      lockToken,
      expectedVersion: locked.tokenVersion,
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: encryptToken(refreshToken),
      tokenExpiresAt: now + expiresIn * 1000,
      scopes: typeof json.scope === 'string' ? json.scope : null,
    };
    const commitRefresh = dependencies.commitRefresh || commitSallaTokenRefresh;
    const getConnection = dependencies.getConnection || getSallaConnectionByMerchant;
    const wait = dependencies.wait ||
      ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (await commitRefresh(commitInput)) return accessToken;
      } catch {
        // The write may have committed before the response was lost. Confirm
        // persisted state before deciding the rotation is uncertain.
      }
      try {
        const current = await getConnection(locked.merchantId);
        if (
          current?.refreshState === 'idle' &&
          current.refreshAttemptId === lockToken &&
          current.tokenVersion > locked.tokenVersion &&
          usable(current, Date.now())
        ) {
          return decryptToken(current.accessTokenEncrypted!);
        }
      } catch {
        // Retry the same local persistence; never call Salla again.
      }
      if (attempt < 2) await wait(50);
    }
    throw new SallaTokenUnavailableError();
  } catch (error) {
    if (providerRequestStarted) {
      try {
        await (dependencies.markUncertain || markSallaRefreshUncertain)(
          connection.merchantId,
          lockToken,
          locked.tokenVersion
        );
      } catch {
        // A surviving in_progress state is also non-reusable and fail-closed.
      }
    } else {
      try {
        await (dependencies.releaseLock || releaseSallaRefreshAttemptBeforeRequest)(
          connection.merchantId,
          lockToken,
          locked.tokenVersion
        );
      } catch {
        // Do not replace the sanitized token error with storage details.
      }
    }
    if (error instanceof SallaTokenUnavailableError) throw error;
    throw new SallaTokenUnavailableError();
  }
}

export async function getSallaAccessTokenForMerchant(
  merchantId: string,
  options: { fetcher?: typeof fetch; now?: number } = {}
): Promise<string> {
  const now = options.now ?? Date.now();
  const connection = await getSallaConnectionByMerchant(merchantId);
  if (!connection || connection.status !== 'connected' || !connection.userId) {
    throw new SallaTokenUnavailableError();
  }
  if (usable(connection, now)) {
    return decryptSallaToken(connection.accessTokenEncrypted!);
  }
  return refreshSallaToken(connection, options.fetcher || fetch, now);
}

export async function getAuthenticatedSallaAccessToken(
  userId: string,
  options: { fetcher?: typeof fetch; now?: number } = {}
): Promise<{ merchantId: string; accessToken: string }> {
  const connection = await getSallaConnectionForUser(userId);
  if (!connection || connection.userId !== userId) {
    throw new SallaTokenUnavailableError();
  }
  return {
    merchantId: connection.merchantId,
    accessToken: await getSallaAccessTokenForMerchant(connection.merchantId, options),
  };
}

/**
 * Refresh a provider-rejected access token only when the token still belongs
 * to the authenticated user's connection.  The token-service lock and
 * tokenVersion compare make a concurrent caller re-check the persisted winner
 * instead of submitting the refresh grant a second time.
 */
export async function refreshAuthenticatedSallaAccessTokenForRejectedToken(
  userId: string,
  rejectedAccessToken: string,
  options: { fetcher?: typeof fetch; now?: number } = {}
): Promise<{ merchantId: string; accessToken: string }> {
  const connection = await getSallaConnectionForUser(userId);
  if (
    !connection ||
    connection.userId !== userId ||
    connection.status !== 'connected'
  ) {
    throw new SallaTokenUnavailableError();
  }

  return {
    merchantId: connection.merchantId,
    accessToken: await refreshSallaToken(
      connection,
      options.fetcher || fetch,
      options.now ?? Date.now(),
      { rejectedAccessToken }
    ),
  };
}