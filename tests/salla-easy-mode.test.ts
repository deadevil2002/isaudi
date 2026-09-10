import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SALLA_INSTALL_URL, SALLA_USER_INFO_URL } from '../src/lib/salla/constants';
import {
  processSallaWebhook,
  SallaWebhookValidationError,
} from '../src/lib/salla/webhook';
import { refreshSallaToken, SallaTokenUnavailableError } from '../src/lib/salla/token-service';
import {
  applySallaLifecycle,
  commitSallaTokenRefresh,
  getOwnedSallaConnectState,
  SALLA_ACQUIRE_REFRESH_SQL,
  SALLA_AUTHORIZATION_UPSERT_SQL,
  SALLA_INFORMATIONAL_UPSERT_SQL,
  SALLA_MARK_REFRESH_UNCERTAIN_SQL,
  SALLA_TERMINAL_UPSERT_SQL,
  upsertSallaAuthorization,
} from '../src/lib/salla/repository';
import {
  createSallaTokenCipher,
  SallaTokenCryptoConfigurationError,
} from '../src/lib/salla/token-crypto';
import type { SallaConnection } from '../src/lib/salla/types';

const authorize = {
  event: 'app.store.authorize',
  merchant: 42,
  created_at: 1_700_000_000,
  data: {
    access_token: 'access-secret',
    refresh_token: 'refresh-secret',
    expires_in: 3600,
    scope: 'orders.read products.read',
  },
};

type SqlValue = string | number | null;
type SqlRow = Record<string, string | number | null>;

function sqlLiteral(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

function bindSql(sql: string, parameters: SqlValue[]): string {
  return sql.replace(/\?(\d+)/g, (_placeholder, index: string) => {
    const value = parameters[Number(index) - 1];
    assert.notEqual(value, undefined);
    return sqlLiteral(value);
  });
}

function authorizationSql(
  merchantId: string,
  userId: string | null,
  eventAt: number,
  token: string
): string {
  return bindSql(SALLA_AUTHORIZATION_UPSERT_SQL, [
    merchantId, userId, token, `refresh-${token}`, eventAt + 10_000,
    'orders.read', 'authorizer', `${userId || 'none'}@example.com`,
    'Owner', 'owner', eventAt, eventAt, eventAt,
  ]);
}

function terminalSql(merchantId: string, eventAt: number): string {
  return bindSql(SALLA_TERMINAL_UPSERT_SQL, [
    merchantId, 'uninstalled', eventAt, eventAt, 'app.uninstalled',
    eventAt, eventAt,
  ]);
}

function sqliteRows(statements: string): SqlRow[] {
  const migration = readFileSync(
    new URL('../migrations/0012_salla_easy_mode.sql', import.meta.url),
    'utf8'
  );
  const result = spawnSync('sqlite3', ['-json', ':memory:'], {
    encoding: 'utf8',
    input: `
      PRAGMA foreign_keys = ON;
      CREATE TABLE users(id TEXT PRIMARY KEY);
      INSERT INTO users(id) VALUES ('u1'), ('u2');
      ${migration}
      ${statements}
    `,
  });
  assert.equal(result.status, 0, result.stderr);
  if (!result.stdout.trim()) return [];
  return result.stdout
    .trim()
    .split(/\n(?=\[)/)
    .flatMap((output) => JSON.parse(output) as SqlRow[]);
}

test('connect action uses exact Easy Mode install URL, not custom OAuth start', () => {
  assert.equal(SALLA_INSTALL_URL, 'https://s.salla.sa/apps/install/613623113');
  const source = readFileSync(
    new URL('../src/app/(authenticated)/connect/salla/page.tsx', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /\/api\/connect\/salla\/start|redirect_uri|state=/);
  assert.match(source, /SALLA_INSTALL_URL/);
});

test('valid authorize verifies Salla identity and stores encrypted credentials', async () => {
  let stored: Parameters<typeof upsertSallaAuthorization>[0] | undefined;
  let requested = '';
  const result = await processSallaWebhook(authorize, {
    fetcher: async (input, init) => {
      requested = String(input);
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer access-secret'
      );
      return new Response(JSON.stringify({
        data: { id: 7, email: 'Owner@Example.com', name: 'Owner', role: 'owner', merchant: { id: 42 } },
      }));
    },
    findUser: async (email) => {
      assert.equal(email, 'owner@example.com');
      return 'verified-user';
    },
    encryptToken: (token) => `encrypted:${token}`,
    upsertAuthorization: async (input) => { stored = input; },
  });
  assert.ok(stored);
  assert.equal(requested, SALLA_USER_INFO_URL);
  assert.equal(result, 'mutated');
  assert.equal(stored.merchantId, '42');
  assert.equal(stored.candidateUserId, 'verified-user');
  assert.equal(stored.accessTokenEncrypted, 'encrypted:access-secret');
  assert.equal(stored.refreshTokenEncrypted, 'encrypted:refresh-secret');
});

test('unverified or unmatched authorizer remains unclaimed', async () => {
  let owner: string | null | undefined;
  await processSallaWebhook(authorize, {
    fetcher: async () => new Response(JSON.stringify({
      data: { id: 7, email: 'other@example.com', merchant: { id: 42 } },
    })),
    findUser: async () => null,
    encryptToken: (token) => token,
    upsertAuthorization: async (input) => { owner = input.candidateUserId; },
  });
  assert.equal(owner, null);
});

test('merchant identity mismatch and malformed relevant payloads are rejected', async () => {
  await assert.rejects(
    processSallaWebhook(authorize, {
      fetcher: async () => new Response(JSON.stringify({
        data: { email: 'owner@example.com', merchant: { id: 99 } },
      })),
    }),
    SallaWebhookValidationError
  );
  await assert.rejects(
    processSallaWebhook({ event: 'app.uninstalled', data: {} }),
    SallaWebhookValidationError
  );
  await assert.rejects(
    processSallaWebhook({
      event: 'app.store.authorize',
      merchant: 42,
      data: { access_token: 'token-only' },
    }),
    SallaWebhookValidationError
  );
  await assert.rejects(
    processSallaWebhook({ event: 'app.updated', merchant: 42 }),
    SallaWebhookValidationError
  );
});

test('updated and uninstall lifecycle events mutate without tokens or ordering assumptions', async () => {
  const calls: unknown[][] = [];
  const applyLifecycle: typeof applySallaLifecycle = async (...args) => {
    calls.push(args);
  };
  await processSallaWebhook(
    { event: 'app.updated', merchant_id: '42', created_at: 1_700_000_001 },
    { applyLifecycle }
  );
  await processSallaWebhook(
    { event: 'app.uninstalled', merchant: { id: 42 }, created_at: 1_700_000_002 },
    { applyLifecycle }
  );
  assert.deepEqual(calls.map((call) => call.slice(0, 2)), [
    ['42', 'app.updated'],
    ['42', 'app.uninstalled'],
  ]);
});

test('unknown valid events are acknowledged without mutation', async () => {
  assert.equal(
    await processSallaWebhook({ event: 'order.created', data: { id: 1 } }),
    'ignored'
  );
});

const expiredConnection: SallaConnection = {
  merchantId: '42',
  userId: 'user',
  status: 'connected',
  accessTokenEncrypted: 'old-access',
  refreshTokenEncrypted: 'old-refresh',
  tokenExpiresAt: 1,
  scopes: 'orders.read',
  tokenVersion: 3,
  refreshState: 'idle',
  refreshAttemptId: null,
  refreshAttemptStartedAt: null,
  refreshLockToken: null,
  refreshLockExpiresAt: null,
};

test('status requires reconnect for uncertain or abandoned refresh attempts', () => {
  const now = Date.now();
  assert.equal(
    getOwnedSallaConnectState({
      ...expiredConnection,
      refreshState: 'uncertain',
    }, now),
    'reconnect_required'
  );
  assert.equal(
    getOwnedSallaConnectState({
      ...expiredConnection,
      refreshState: 'in_progress',
      refreshAttemptId: 'abandoned-attempt',
      refreshAttemptStartedAt: now - 60_000,
      refreshLockToken: 'abandoned-attempt',
      refreshLockExpiresAt: now - 1,
    }, now),
    'reconnect_required'
  );
  assert.equal(
    getOwnedSallaConnectState({
      ...expiredConnection,
      refreshState: 'in_progress',
      refreshAttemptId: 'active-attempt',
      refreshAttemptStartedAt: now,
      refreshLockToken: 'active-attempt',
      refreshLockExpiresAt: now + 30_000,
    }, now),
    'connected'
  );
});

test('reconnect-required UI keeps exact install action enabled with explicit label', () => {
  const source = readFileSync(
    new URL('../src/app/(authenticated)/connect/salla/page.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /"reconnect_required"/);
  assert.match(source, /connect\.salla\.button\.reconnect/);
  assert.match(source, /disabled=\{loading \|\| connectState === "connected"\}/);
  assert.doesNotMatch(
    source,
    /disabled=\{[^}]*reconnect_required/
  );
  assert.match(source, /window\.location\.href = SALLA_INSTALL_URL/);
});

test('refresh grant rotates both tokens atomically and never exposes credentials in errors', async () => {
  let commit: Parameters<typeof commitSallaTokenRefresh>[0] | undefined;
  const access = await refreshSallaToken(
    expiredConnection,
    async (_input, init) => {
      const body = init?.body as URLSearchParams;
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('refresh_token'), 'decrypted-refresh');
      return new Response(JSON.stringify({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      }));
    },
    1000,
    {
      createLockToken: () => 'lock',
      acquireLock: async () => expiredConnection,
      releaseLock: async () => undefined,
      commitRefresh: async (input) => { commit = input; return true; },
      environment: () => ({ SALLA_CLIENT_ID: 'client', SALLA_CLIENT_SECRET: 'secret' }),
      decryptToken: () => 'decrypted-refresh',
      encryptToken: (token) => `encrypted:${token}`,
    }
  );
  assert.ok(commit);
  assert.equal(access, 'new-access');
  assert.equal(commit.expectedVersion, 3);
  assert.equal(commit.accessTokenEncrypted, 'encrypted:new-access');
  assert.equal(commit.refreshTokenEncrypted, 'encrypted:new-refresh');

  await assert.rejects(
    refreshSallaToken(expiredConnection, async () => {
      return new Response('{"error":"invalid_grant"}', { status: 400 });
    }, 1000, {
      acquireLock: async () => expiredConnection,
      releaseLock: async () => undefined,
      environment: () => ({ SALLA_CLIENT_ID: 'client', SALLA_CLIENT_SECRET: 'secret' }),
      decryptToken: () => 'credential-that-must-not-leak',
    }),
    (error: unknown) => error instanceof SallaTokenUnavailableError &&
      !error.message.includes('credential-that-must-not-leak')
  );
});

test('delayed refresh lock winner rechecks the locked token before provider call', async () => {
  let fetchCalls = 0;
  let releases = 0;
  const refreshed: SallaConnection = {
    ...expiredConnection,
    accessTokenEncrypted: 'encrypted:winner-token',
    tokenExpiresAt: Date.now() + 120_000,
    refreshLockToken: 'new-lock',
  };
  const token = await refreshSallaToken(
    expiredConnection,
    async () => {
      fetchCalls += 1;
      throw new Error('provider must not be called');
    },
    Date.now(),
    {
      acquireLock: async () => refreshed,
      releaseLock: async () => { releases += 1; },
      decryptToken: (value) => value.replace('encrypted:', ''),
    }
  );
  assert.equal(token, 'winner-token');
  assert.equal(fetchCalls, 0);
  assert.equal(releases, 1);
});

test('refresh timeout remains active while consuming the response body', async () => {
  await assert.rejects(
    refreshSallaToken(
      expiredConnection,
      async (_input, init) => {
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, 'json', {
          value: () => new Promise<never>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new Error('body aborted')),
              { once: true }
            );
          }),
        });
        return response;
      },
      Date.now(),
      {
        acquireLock: async () => expiredConnection,
        releaseLock: async () => undefined,
        environment: () => ({
          SALLA_CLIENT_ID: 'client',
          SALLA_CLIENT_SECRET: 'secret',
        }),
        decryptToken: () => 'refresh',
        fetchTimeoutMs: 10,
      }
    ),
    SallaTokenUnavailableError
  );
});

test('rotated response with unconfirmed commit blocks reuse of old refresh token', async () => {
  let state: SallaConnection = { ...expiredConnection };
  let providerCalls = 0;
  let commitAttempts = 0;
  const dependencies = {
    acquireLock: async (_merchantId: string, attemptId: string) => {
      if (state.refreshState !== 'idle') return undefined;
      state = {
        ...state,
        refreshState: 'in_progress' as const,
        refreshAttemptId: attemptId,
        refreshAttemptStartedAt: Date.now(),
        refreshLockToken: attemptId,
      };
      return { ...state };
    },
    getConnection: async () => ({ ...state }),
    commitRefresh: async () => {
      commitAttempts += 1;
      throw new Error('ambiguous database response');
    },
    markUncertain: async (_merchantId: string, attemptId: string) => {
      if (state.refreshAttemptId === attemptId) {
        state = {
          ...state,
          refreshState: 'uncertain',
          refreshLockToken: null,
          refreshLockExpiresAt: null,
        };
      }
    },
    environment: () => ({
      SALLA_CLIENT_ID: 'client',
      SALLA_CLIENT_SECRET: 'secret',
    }),
    decryptToken: () => 'old-refresh',
    encryptToken: (token: string) => `encrypted:${token}`,
    wait: async () => undefined,
  };
  const fetcher = async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({
      access_token: 'rotated-access',
      refresh_token: 'rotated-refresh',
      expires_in: 3600,
    }));
  };
  await assert.rejects(
    refreshSallaToken(expiredConnection, fetcher, Date.now(), dependencies),
    SallaTokenUnavailableError
  );
  assert.equal(state.refreshState, 'uncertain');
  await assert.rejects(
    refreshSallaToken(expiredConnection, fetcher, Date.now(), dependencies),
    SallaTokenUnavailableError
  );
  assert.equal(providerCalls, 1);
  assert.equal(commitAttempts, 3);
});

test('ambiguous provider timeout blocks a second submission of old refresh token', async () => {
  let state: SallaConnection = { ...expiredConnection };
  let providerCalls = 0;
  const dependencies = {
    acquireLock: async (_merchantId: string, attemptId: string) => {
      if (state.refreshState !== 'idle') return undefined;
      state = {
        ...state,
        refreshState: 'in_progress' as const,
        refreshAttemptId: attemptId,
        refreshAttemptStartedAt: Date.now(),
        refreshLockToken: attemptId,
      };
      return { ...state };
    },
    getConnection: async () => ({ ...state }),
    markUncertain: async () => {
      state = {
        ...state,
        refreshState: 'uncertain',
        refreshLockToken: null,
        refreshLockExpiresAt: null,
      };
    },
    environment: () => ({
      SALLA_CLIENT_ID: 'client',
      SALLA_CLIENT_SECRET: 'secret',
    }),
    decryptToken: () => 'old-refresh',
    wait: async () => undefined,
    fetchTimeoutMs: 10,
  };
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    providerCalls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new Error('ambiguous timeout')),
        { once: true }
      );
    });
  };
  await assert.rejects(
    refreshSallaToken(expiredConnection, fetcher, Date.now(), dependencies),
    SallaTokenUnavailableError
  );
  await assert.rejects(
    refreshSallaToken(expiredConnection, fetcher, Date.now(), dependencies),
    SallaTokenUnavailableError
  );
  assert.equal(state.refreshState, 'uncertain');
  assert.equal(providerCalls, 1);
});

test('concurrent refresh callers share the database winner and call Salla once', async () => {
  let state: SallaConnection = {
    ...expiredConnection,
    tokenExpiresAt: Date.now() - 1,
  };
  let lockHeld = false;
  let fetchCalls = 0;
  let lockSequence = 0;
  const dependencies = {
    createLockToken: () => `lock-${++lockSequence}`,
    acquireLock: async (_merchantId: string, lockToken: string) => {
      if (lockHeld) return undefined;
      lockHeld = true;
      state = { ...state, refreshLockToken: lockToken };
      return { ...state };
    },
    getConnection: async () => ({ ...state }),
    commitRefresh: async (
      input: Parameters<typeof commitSallaTokenRefresh>[0]
    ) => {
      if (state.refreshLockToken !== input.lockToken) return false;
      state = {
        ...state,
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        tokenVersion: state.tokenVersion + 1,
        refreshLockToken: null,
      };
      return true;
    },
    releaseLock: async (_merchantId: string, lockToken: string) => {
      if (state.refreshLockToken === lockToken) {
        state = { ...state, refreshLockToken: null };
      }
      lockHeld = false;
    },
    environment: () => ({
      SALLA_CLIENT_ID: 'client',
      SALLA_CLIENT_SECRET: 'secret',
    }),
    decryptToken: (token: string) =>
      token.startsWith('encrypted:') ? token.slice('encrypted:'.length) : 'refresh',
    encryptToken: (token: string) => `encrypted:${token}`,
  };
  const fetcher = async () => {
    fetchCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return new Response(JSON.stringify({
      access_token: 'winner-access',
      refresh_token: 'winner-refresh',
      expires_in: 3600,
    }));
  };
  const now = Date.now();
  const [first, second] = await Promise.all([
    refreshSallaToken(expiredConnection, fetcher, now, dependencies),
    refreshSallaToken(expiredConnection, fetcher, now, dependencies),
  ]);
  assert.deepEqual([first, second], ['winner-access', 'winner-access']);
  assert.equal(fetchCalls, 1);
});

test('new Easy Mode token encryption is authenticated and fails closed without key', () => {
  assert.throws(
    () => createSallaTokenCipher(undefined),
    SallaTokenCryptoConfigurationError
  );
  const cipher = createSallaTokenCipher('test-only-key-material');
  const encrypted = cipher.encrypt('sensitive-token');
  assert.match(encrypted, /^salla:v1:/);
  assert.equal(cipher.decrypt(encrypted), 'sensitive-token');
  const parts = encrypted.split(':');
  parts[3] = `${parts[3].startsWith('A') ? 'B' : 'A'}${parts[3].slice(1)}`;
  const tampered = parts.join(':');
  assert.throws(() => cipher.decrypt(tampered));
});

test('SQLite authorization rejects stale ownership and conflicting merchant claims', () => {
  const rows = sqliteRows(`
    ${authorizationSql('m1', 'u1', 100, 'first')}
    ${authorizationSql('m1', 'u2', 90, 'stale')}
    ${authorizationSql('m2', 'u1', 110, 'conflict')}
    ${authorizationSql('m3', null, 100, 'unclaimed')}
    ${authorizationSql('m3', 'u2', 90, 'stale-claim')}
    SELECT merchantId, userId, accessTokenEncrypted
    FROM salla_connections ORDER BY merchantId;
  `);
  assert.deepEqual(rows, [
    { merchantId: 'm1', userId: 'u1', accessTokenEncrypted: 'first' },
    { merchantId: 'm2', userId: null, accessTokenEncrypted: 'conflict' },
    { merchantId: 'm3', userId: null, accessTokenEncrypted: 'unclaimed' },
  ]);
});

test('SQLite duplicate authorization is a full no-op including refresh lock', () => {
  const rows = sqliteRows(`
    ${authorizationSql('m1', 'u1', 100, 'initial')}
    UPDATE salla_connections
      SET refreshLockToken = 'live-lock', refreshLockExpiresAt = 999;
    ${authorizationSql('m1', 'u2', 100, 'duplicate')}
    SELECT userId, accessTokenEncrypted, refreshLockToken, refreshLockExpiresAt
      FROM salla_connections;
  `);
  assert.deepEqual(rows, [{
    userId: 'u1',
    accessTokenEncrypted: 'initial',
    refreshLockToken: 'live-lock',
    refreshLockExpiresAt: 999,
  }]);
});

test('SQLite informational lifecycle does not suppress older authorization', () => {
  const informational = bindSql(SALLA_INFORMATIONAL_UPSERT_SQL, [
    'm1', 200, 200, null,
  ]);
  const rows = sqliteRows(`
    ${informational}
    ${authorizationSql('m1', 'u1', 100, 'authorized')}
    SELECT status, installedAt, lastEventAt, accessTokenEncrypted
    FROM salla_connections;
  `);
  assert.deepEqual(rows, [{
    status: 'connected',
    installedAt: 200,
    lastEventAt: 100,
    accessTokenEncrypted: 'authorized',
  }]);
});

test('SQLite terminal precedence, duplicate no-op, and later reauthorize are deterministic', () => {
  const rows = sqliteRows(`
    ${authorizationSql('m1', 'u1', 100, 'initial')}
    ${terminalSql('m1', 100)}
    UPDATE salla_connections
      SET refreshLockToken = 'live-lock', refreshLockExpiresAt = 999;
    ${terminalSql('m1', 100)}
    ${authorizationSql('m1', 'u2', 100, 'duplicate')}
    SELECT status, userId, accessTokenEncrypted, refreshLockToken, lastEventPriority
      FROM salla_connections;
    ${authorizationSql('m1', 'u2', 101, 'later')}
    SELECT status, userId, accessTokenEncrypted, refreshLockToken, lastEventPriority
      FROM salla_connections;
  `);
  assert.deepEqual(rows, [
    {
      status: 'uninstalled',
      userId: 'u1',
      accessTokenEncrypted: null,
      refreshLockToken: 'live-lock',
      lastEventPriority: 100,
    },
    {
      status: 'connected',
      userId: 'u1',
      accessTokenEncrypted: 'later',
      refreshLockToken: null,
      lastEventPriority: 10,
    },
  ]);
});

test('SQLite stale terminal webhook cannot clear a live refresh lock', () => {
  const rows = sqliteRows(`
    ${authorizationSql('m1', 'u1', 200, 'current')}
    UPDATE salla_connections
      SET refreshLockToken = 'live-lock', refreshLockExpiresAt = 999;
    ${terminalSql('m1', 100)}
    SELECT status, accessTokenEncrypted, refreshLockToken, refreshLockExpiresAt
      FROM salla_connections;
  `);
  assert.deepEqual(rows, [{
    status: 'connected',
    accessTokenEncrypted: 'current',
    refreshLockToken: 'live-lock',
    refreshLockExpiresAt: 999,
  }]);
});

test('SQLite persisted refresh attempt blocks reuse until newer authorize resets it', () => {
  const acquire = bindSql(SALLA_ACQUIRE_REFRESH_SQL, [
    'attempt-1', 110, 140, 'm1',
  ]);
  const uncertain = bindSql(SALLA_MARK_REFRESH_UNCERTAIN_SQL, [
    'm1', 'attempt-1', 1,
  ]);
  const rows = sqliteRows(`
    ${authorizationSql('m1', 'u1', 100, 'initial')}
    ${acquire}
    ${uncertain}
    SELECT refreshState, refreshAttemptId, accessTokenEncrypted
      FROM salla_connections;
    ${authorizationSql('m1', 'u1', 120, 'reauthorized')}
    SELECT refreshState, refreshAttemptId, refreshAttemptStartedAt,
      accessTokenEncrypted FROM salla_connections;
  `).slice(-2);
  assert.deepEqual(rows, [
    {
      refreshState: 'uncertain',
      refreshAttemptId: 'attempt-1',
      accessTokenEncrypted: 'initial',
    },
    {
      refreshState: 'idle',
      refreshAttemptId: null,
      refreshAttemptStartedAt: null,
      accessTokenEncrypted: 'reauthorized',
    },
  ]);
});

test('app.updated is lifecycle-only and cannot replace credentials', async () => {
  let lifecycleCalls = 0;
  let fetchCalls = 0;
  await processSallaWebhook({
    event: 'app.updated',
    merchant: 42,
    created_at: 1_700_000_003,
    data: {
      access_token: 'must-be-ignored',
      refresh_token: 'must-be-ignored',
    },
  }, {
    fetcher: async () => { fetchCalls += 1; return new Response(); },
    applyLifecycle: async () => { lifecycleCalls += 1; },
  });
  assert.equal(lifecycleCalls, 1);
  assert.equal(fetchCalls, 0);
});

test('webhook route verifies signature before parsing and never logs token material', () => {
  const route = readFileSync(
    new URL('../src/app/api/webhooks/salla/route.ts', import.meta.url),
    'utf8'
  );
  const routeBodyStart = route.indexOf('export async function POST');
  const signatureCall = route.indexOf(
    'verifySallaWebhookSignature(',
    routeBodyStart
  );
  assert.ok(
    signatureCall > routeBodyStart &&
      signatureCall < route.indexOf('JSON.parse(rawBody)')
  );
  const invalidBody = '{"event":';
  const signatureForDifferentBody = createHmac('sha256', 'secret')
    .update('{}')
    .digest('hex');
  assert.notEqual(
    createHmac('sha256', 'secret').update(invalidBody).digest('hex'),
    signatureForDifferentBody
  );
  const webhookSource = readFileSync(
    new URL('../src/lib/salla/webhook.ts', import.meta.url),
    'utf8'
  );
  const tokenSource = readFileSync(
    new URL('../src/lib/salla/token-service.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(webhookSource, /console\./);
  assert.doesNotMatch(tokenSource, /console\./);
  assert.match(
    route,
    /console\.error\('Salla webhook processing failed', \{ provider: 'salla' \}\)/
  );
});