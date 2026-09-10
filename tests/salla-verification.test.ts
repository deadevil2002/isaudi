import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  listOrders,
  listProducts,
  SallaReadError,
  verificationErrorForRead,
} from '../src/lib/salla/client';
import { refreshSallaToken } from '../src/lib/salla/token-service';
import { commitSallaTokenRefresh } from '../src/lib/salla/repository';
import {
  SallaVerificationPreconditionError,
  verifySallaConnection,
} from '../src/lib/salla/verification';
import {
  createSallaVerifyHandler,
  hasUnexpectedInput,
} from '../src/lib/salla/verify-handler';
import type { SallaConnection } from '../src/lib/salla/types';

const connection: SallaConnection = {
  merchantId: 'owned-merchant',
  userId: 'owner-1',
  status: 'connected',
  accessTokenEncrypted: 'encrypted:access-token',
  refreshTokenEncrypted: 'encrypted:refresh-token',
  tokenExpiresAt: Date.now() + 60 * 60 * 1000,
  scopes: 'products.read orders.read',
  tokenVersion: 1,
  refreshState: 'idle',
  refreshAttemptId: null,
  refreshAttemptStartedAt: null,
  refreshLockToken: null,
  refreshLockExpiresAt: null,
};

function resolveAccessToken() {
  return Promise.resolve({
    merchantId: connection.merchantId,
    accessToken: 'access-token',
  });
}

function providerPage(records: unknown[], pagination = {}) {
  return new Response(JSON.stringify({
    data: records,
    pagination,
    providerOnly: 'must not cross verification boundary',
  }));
}

test('read client uses the documented first-page URLs and safe fetch options', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return providerPage([{ id: 'product-1', name: 'private product' }], {
      currentPage: 1,
      totalPages: 4,
      total: 17,
      ignored: 'not projected',
    });
  };

  const result = await listProducts('owner-1', {
    fetcher,
    resolveAccessToken,
  });

  assert.deepEqual(result, {
    records: [{ id: 'product-1', name: 'private product' }],
    count: 1,
    pagination: { currentPage: 1, totalPages: 4, total: 17 },
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.salla.dev/admin/v2/products?page=1&per_page=5'
  );
  assert.equal(calls[0].init?.method, 'GET');
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(
    new Headers(calls[0].init?.headers).get('Authorization'),
    'Bearer access-token'
  );
});

test('HTTP 200 provider error envelopes and unsafe pagination fail closed', async () => {
  await assert.rejects(
    listProducts('owner-1', {
      resolveAccessToken,
      fetcher: async () => new Response(JSON.stringify({
        status: 200,
        success: false,
        data: [{ id: 'must-not-be-accepted' }],
        pagination: { currentPage: 1, totalPages: 1, total: 1 },
      })),
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'invalid_response'
  );
  await assert.rejects(
    listProducts('owner-1', {
      resolveAccessToken,
      fetcher: async () => new Response(JSON.stringify({
        status: 500,
        success: true,
        data: [],
      })),
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'invalid_response'
  );

  const unsafePagination = await listProducts('owner-1', {
    resolveAccessToken,
    fetcher: async () => providerPage([], {
      currentPage: -1,
      totalPages: 1.5,
      total: Number.MAX_SAFE_INTEGER + 1,
    }),
  });
  assert.deepEqual(unsafePagination.pagination, {
    currentPage: null,
    totalPages: null,
    total: null,
  });
});

test('response size cap cancels the provider stream', async () => {
  let cancelled = false;
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(512 * 1024 + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    listProducts('owner-1', {
      resolveAccessToken,
      fetcher: async () => new Response(oversized),
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'invalid_response'
  );
  assert.equal(cancelled, true);
});

test('orders use the documented first page and retain provider records only server-side', async () => {
  let requested = '';
  const result = await listOrders('owner-1', {
    resolveAccessToken,
    fetcher: async (input) => {
      requested = String(input);
      return providerPage([{ id: 'order-1', customer: { email: 'private@example.com' } }], {
        currentPage: 1,
        totalPages: 2,
        total: 6,
      });
    },
  });

  assert.equal(
    requested,
    'https://api.salla.dev/admin/v2/orders?page=1&per_page=5'
  );
  assert.equal(result.records[0].customer && typeof result.records[0].customer, 'object');
  assert.equal(result.pagination.currentPage, 1);
});

test('documented invalid-token response refreshes once and retries only once', async () => {
  let apiCalls = 0;
  let refreshCalls = 0;
  const result = await listProducts('owner-1', {
    resolveAccessToken,
    refreshRejectedToken: async (userId, rejectedToken) => {
      refreshCalls += 1;
      assert.equal(userId, 'owner-1');
      assert.equal(rejectedToken, 'access-token');
      return { merchantId: 'owned-merchant', accessToken: 'new-access-token' };
    },
    fetcher: async (_input, init) => {
      apiCalls += 1;
      assert.equal(init?.method, 'GET');
      if (apiCalls === 1) {
        return new Response(JSON.stringify({
          status: 401,
          success: false,
          error: { code: 'Unauthorized', message: 'The access token is invalid' },
        }), { status: 401 });
      }
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer new-access-token'
      );
      return providerPage([{ id: 'p1' }]);
    },
  });

  assert.equal(result.count, 1);
  assert.equal(apiCalls, 2);
  assert.equal(refreshCalls, 1);
});

test('valid token is not refreshed and scope denial is never mistaken for expiry', async () => {
  let refreshCalls = 0;
  const fetcher: typeof fetch = async () => providerPage([]);
  await listProducts('owner-1', {
    fetcher,
    resolveAccessToken,
    refreshRejectedToken: async () => {
      refreshCalls += 1;
      return { merchantId: 'owned-merchant', accessToken: 'must-not-use' };
    },
  });
  assert.equal(refreshCalls, 0);

  await assert.rejects(
    listOrders('owner-1', {
      resolveAccessToken,
      refreshRejectedToken: async () => {
        refreshCalls += 1;
        return { merchantId: 'owned-merchant', accessToken: 'must-not-use' };
      },
      fetcher: async () => new Response(JSON.stringify({
        status: 401,
        error: {
          code: 'Unauthorized',
          message: 'The access token should have access to one of those scopes: orders.read',
        },
      }), { status: 401 }),
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'scope_denied'
  );
  assert.equal(refreshCalls, 0);
});

test('ambiguous 401 fails closed and a second invalid-token retry does not loop', async () => {
  let refreshCalls = 0;
  await assert.rejects(
    listProducts('owner-1', {
      resolveAccessToken,
      refreshRejectedToken: async () => {
        refreshCalls += 1;
        return { merchantId: 'owned-merchant', accessToken: 'new-token' };
      },
      fetcher: async () => new Response(JSON.stringify({
        status: 401,
        error: { code: 'Unauthorized', message: 'not a documented marker' },
      }), { status: 401 }),
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'provider_error'
  );
  assert.equal(refreshCalls, 0);

  let apiCalls = 0;
  await assert.rejects(
    listProducts('owner-1', {
      resolveAccessToken,
      refreshRejectedToken: async () => {
        refreshCalls += 1;
        return { merchantId: 'owned-merchant', accessToken: 'new-token' };
      },
      fetcher: async () => {
        apiCalls += 1;
        return new Response(JSON.stringify({
          status: 401,
          error: { code: 'Unauthorized', message: 'The access token is invalid' },
        }), { status: 401 });
      },
    }),
    (error: unknown) =>
      error instanceof SallaReadError && error.category === 'auth_rejected'
  );
  assert.equal(apiCalls, 2);
  assert.equal(refreshCalls, 1);
});

test('verification is owner-scoped, rejects unclaimed/disconnected connections, and projects no records', async () => {
  let reads = 0;
  const readProducts = async () => {
    reads += 1;
    return {
      records: [{
        id: 'p1',
        name: 'private product',
        sku: 'secret-sku',
        token: 'secret-token',
      }],
      count: 1,
      pagination: { currentPage: 1, totalPages: 1, total: 1 },
    };
  };
  const readOrders = async () => ({
    records: [{
      id: 'o1',
      customer: { email: 'private@example.com', phone: 'secret-phone' },
      access_token: 'secret-token',
    }],
    count: 1,
    pagination: { currentPage: 1, totalPages: 1, total: 1 },
  });

  const result = await verifySallaConnection('owner-1', {
    getConnection: async (userId) => userId === 'owner-1' ? connection : undefined,
    readProducts,
    readOrders,
  });
  const encoded = JSON.stringify(result);
  assert.deepEqual(result, {
    connected: true,
    products: {
      ok: true,
      count: 1,
      pagination: { currentPage: 1, totalPages: 1, total: 1 },
    },
    orders: {
      ok: true,
      count: 1,
      pagination: { currentPage: 1, totalPages: 1, total: 1 },
    },
  });
  assert.equal(reads, 1);
  assert.doesNotMatch(encoded, /private product|secret-sku|secret-token|private@example\.com/);

  await assert.rejects(
    verifySallaConnection('other-user', {
      getConnection: async () => connection,
      readProducts,
      readOrders,
    }),
    SallaVerificationPreconditionError
  );
  await assert.rejects(
    verifySallaConnection('owner-1', {
      getConnection: async () => ({ ...connection, userId: null, status: 'pending' }),
      readProducts,
      readOrders,
    }),
    SallaVerificationPreconditionError
  );
  await assert.rejects(
    verifySallaConnection('owner-1', {
      getConnection: async () => ({ ...connection, status: 'uninstalled' }),
      readProducts,
      readOrders,
    }),
    SallaVerificationPreconditionError
  );
  assert.equal(reads, 1);
});

test('verification failures are safe and never include provider payloads', async () => {
  const result = await verifySallaConnection('owner-1', {
    getConnection: async () => connection,
    readProducts: async () => {
      throw new Error('provider customer email and access-token must not leak');
    },
    readOrders: async () => ({
      records: [],
      count: 0,
      pagination: { currentPage: null, totalPages: null, total: null },
    }),
  });
  assert.deepEqual(result.products, {
    ok: false,
    error: 'Unable to read Salla data',
  });
  assert.doesNotMatch(JSON.stringify(result), /customer email|access-token/);
  assert.equal(
    verificationErrorForRead(
      new SallaReadError('scope_denied')
    ),
    'Salla read permission denied'
  );
});

test('valid-but-rejected token is force-refreshed under the existing atomic path', async () => {
  const validConnection: SallaConnection = {
    ...connection,
    accessTokenEncrypted: 'encrypted:rejected',
    refreshTokenEncrypted: 'encrypted:refresh',
    tokenExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  let providerCalls = 0;
  let committed: Parameters<typeof commitSallaTokenRefresh>[0] | undefined;
  const token = await refreshSallaToken(
    validConnection,
    async () => {
      providerCalls += 1;
      return new Response(JSON.stringify({
        access_token: 'rotated-access',
        refresh_token: 'rotated-refresh',
        expires_in: 3600,
      }));
    },
    1_000,
    {
      rejectedAccessToken: 'rejected',
      createLockToken: () => 'lock-token',
      acquireLock: async () => validConnection,
      releaseLock: async () => undefined,
      commitRefresh: async (input) => {
        committed = input;
        return true;
      },
      decryptToken: (value) => value.replace('encrypted:', ''),
      encryptToken: (value) => `encrypted:${value}`,
      environment: () => ({
        SALLA_CLIENT_ID: 'client',
        SALLA_CLIENT_SECRET: 'secret',
      }),
    }
  );
  assert.equal(token, 'rotated-access');
  assert.equal(providerCalls, 1);
  assert.equal(committed?.expectedVersion, validConnection.tokenVersion);
  assert.ok(validConnection.tokenExpiresAt! > Date.now());
});

test('valid token is preserved when a concurrent rejected-token loser sees it', async () => {
  let state: SallaConnection = {
    ...connection,
    accessTokenEncrypted: 'encrypted:rejected',
    refreshTokenEncrypted: 'encrypted:refresh',
    tokenExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  let lockHeld = false;
  let providerCalls = 0;
  let sequence = 0;
  const dependencies = {
    createLockToken: () => `lock-${++sequence}`,
    acquireLock: async (_merchantId: string, lockToken: string) => {
      if (lockHeld) return undefined;
      lockHeld = true;
      state = {
        ...state,
        refreshState: 'in_progress',
        refreshAttemptId: lockToken,
        refreshLockToken: lockToken,
      };
      return { ...state };
    },
    getConnection: async () => ({ ...state }),
    commitRefresh: async (input: Parameters<typeof commitSallaTokenRefresh>[0]) => {
      state = {
        ...state,
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        tokenVersion: state.tokenVersion + 1,
        refreshState: 'idle',
        refreshAttemptId: null,
        refreshLockToken: null,
      };
      lockHeld = false;
      return true;
    },
    releaseLock: async () => {
      lockHeld = false;
    },
    markUncertain: async () => {
      state = { ...state, refreshState: 'uncertain', refreshLockToken: null };
      lockHeld = false;
    },
    decryptToken: (value: string) => value.replace('encrypted:', ''),
    encryptToken: (value: string) => `encrypted:${value}`,
    environment: () => ({
      SALLA_CLIENT_ID: 'client',
      SALLA_CLIENT_SECRET: 'secret',
    }),
    wait: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    },
  };
  const fetcher: typeof fetch = async () => {
    providerCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify({
      access_token: 'winner-access',
      refresh_token: 'winner-refresh',
      expires_in: 3600,
    }));
  };
  const now = Date.now();
  const [winner, loser] = await Promise.all([
    refreshSallaToken(state, fetcher, now, {
      ...dependencies,
      rejectedAccessToken: 'rejected',
    }),
    refreshSallaToken(state, fetcher, now, {
      ...dependencies,
      rejectedAccessToken: 'rejected',
    }),
  ]);
  assert.deepEqual([winner, loser], ['winner-access', 'winner-access']);
  assert.equal(providerCalls, 1);
});

test('failed forced refresh does not loop or log token material', async () => {
  let state: SallaConnection = {
    ...connection,
    accessTokenEncrypted: 'encrypted:rejected',
    refreshTokenEncrypted: 'encrypted:refresh',
    tokenExpiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  let providerCalls = 0;
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    const dependencies = {
      acquireLock: async (_merchantId: string, lockToken: string) => {
        if (state.refreshState !== 'idle') return undefined;
        state = {
          ...state,
          refreshState: 'in_progress',
          refreshAttemptId: lockToken,
          refreshLockToken: lockToken,
        };
        return { ...state };
      },
      getConnection: async () => ({ ...state }),
      markUncertain: async () => {
        state = {
          ...state,
          refreshState: 'uncertain',
          refreshLockToken: null,
        };
      },
      decryptToken: (value: string) => value.replace('encrypted:', ''),
      environment: () => ({
        SALLA_CLIENT_ID: 'client',
        SALLA_CLIENT_SECRET: 'secret',
      }),
    };
    const fetcher: typeof fetch = async () => {
      providerCalls += 1;
      return new Response('{"error":"invalid_grant"}', { status: 400 });
    };
    await assert.rejects(
      refreshSallaToken(state, fetcher, Date.now(), {
        ...dependencies,
        rejectedAccessToken: 'rejected',
        wait: async () => undefined,
      })
    );
    await assert.rejects(
      refreshSallaToken(state, fetcher, Date.now(), {
        ...dependencies,
        rejectedAccessToken: 'rejected',
        wait: async () => undefined,
      })
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(providerCalls, 1);
  assert.deepEqual(logs, []);
});

test('HTTP verification handler enforces origin, auth, no-input, owner resolution, and no-store', async () => {
  const route = readFileSync(
    new URL('../src/app/api/connect/salla/verify/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(route, /export const POST/);
  assert.doesNotMatch(route, /export (?:async )?function/);

  const noStore = (response: Response) =>
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const emptyRequest = () => new Request(
    'https://isaudi.ai/api/connect/salla/verify',
    { method: 'POST' }
  );

  const unauthenticated = createSallaVerifyHandler({
    guardOrigin: () => null,
    getUser: async () => null,
  });
  const unauthenticatedResponse = await unauthenticated(emptyRequest());
  assert.equal(unauthenticatedResponse.status, 401);
  noStore(unauthenticatedResponse);
  let unauthenticatedBodyPulled = false;
  const earlyRejected = await unauthenticated({
    url: 'https://isaudi.ai/api/connect/salla/verify',
    headers: new Headers(),
    body: {
      getReader() {
        unauthenticatedBodyPulled = true;
        throw new Error('body must not be read before authentication');
      },
    },
  } as unknown as Request);
  assert.equal(earlyRejected.status, 401);
  assert.equal(unauthenticatedBodyPulled, false);
  noStore(earlyRejected);

  const invalidOrigin = createSallaVerifyHandler({
    guardOrigin: () => new Response('Forbidden', { status: 403 }),
    getUser: async () => ({ id: 'must-not-resolve' }),
  });
  const invalidOriginResponse = await invalidOrigin(emptyRequest());
  assert.equal(invalidOriginResponse.status, 403);
  noStore(invalidOriginResponse);

  const noInput = createSallaVerifyHandler({
    guardOrigin: () => null,
    getUser: async () => ({ id: 'must-not-resolve' }),
  });
  const noInputResponse = await noInput(new Request(
    'https://isaudi.ai/api/connect/salla/verify',
    { method: 'POST', body: JSON.stringify({ merchantId: 'other-merchant' }) }
  ));
  assert.equal(noInputResponse.status, 400);
  noStore(noInputResponse);

  let resolvedUserId = '';
  const authenticated = createSallaVerifyHandler({
    guardOrigin: () => null,
    getUser: async () => ({ id: 77 }),
    verify: async (userId) => {
      resolvedUserId = userId;
      return {
        connected: true,
        products: { ok: true, count: 0, pagination: { currentPage: 1, totalPages: 0, total: 0 } },
        orders: { ok: true, count: 0, pagination: { currentPage: 1, totalPages: 0, total: 0 } },
      };
    },
  });
  const authenticatedResponse = await authenticated(emptyRequest());
  assert.equal(authenticatedResponse.status, 200);
  assert.equal(resolvedUserId, '77');
  noStore(authenticatedResponse);

  const emptyStream = new Request(
    'https://isaudi.ai/api/connect/salla/verify',
    {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
      // Node's Request requires this for a stream body.
      duplex: 'half',
    } as RequestInit
  );
  assert.equal(await hasUnexpectedInput(emptyStream), false);
  let inputCancelled = false;
  const suppliedStream = new Request(
    'https://isaudi.ai/api/connect/salla/verify',
    {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('supplied'));
        },
        cancel() {
          inputCancelled = true;
        },
      }),
      headers: { 'content-length': '0' },
      duplex: 'half',
    } as RequestInit
  );
  assert.equal(await hasUnexpectedInput(suppliedStream), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(inputCancelled, true);

  const hangingInput = new Request(
    'https://isaudi.ai/api/connect/salla/verify',
    {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>(() => undefined);
        },
      }),
      duplex: 'half',
    } as RequestInit
  );
  const inputStarted = Date.now();
  assert.equal(await hasUnexpectedInput(hangingInput), true);
  assert.ok(Date.now() - inputStarted < 2_000);
});

test('verify route does not contain browser ownership fields', () => {
  const route = readFileSync(
    new URL('../src/app/api/connect/salla/verify/route.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(route, /merchantId/);
});