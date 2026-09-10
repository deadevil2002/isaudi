import {
  SALLA_ORDERS_URL,
  SALLA_PRODUCTS_URL,
} from './constants';
import {
  getAuthenticatedSallaAccessToken,
  refreshAuthenticatedSallaAccessTokenForRejectedToken,
} from './token-service';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

export type SallaReadOperation = 'products' | 'orders';
export type SallaReadErrorCategory =
  | 'connection_unavailable'
  | 'scope_denied'
  | 'auth_rejected'
  | 'refresh_failed'
  | 'provider_error'
  | 'invalid_response';

export interface SallaPagination {
  currentPage: number | null;
  totalPages: number | null;
  total: number | null;
}

export interface SallaListResult<T = Record<string, unknown>> {
  /** Provider records are intentionally available only to server callers. */
  records: T[];
  count: number;
  pagination: SallaPagination;
}

export class SallaReadError extends Error {
  readonly category: SallaReadErrorCategory;

  constructor(category: SallaReadErrorCategory) {
    super('Salla read request failed');
    this.name = 'SallaReadError';
    this.category = category;
  }
}

export interface ReadClientOptions {
  fetcher?: typeof fetch;
  now?: number;
  resolveAccessToken?: (
    userId: string,
    options: { fetcher: typeof fetch; now: number }
  ) => Promise<{ merchantId: string; accessToken: string }>;
  refreshRejectedToken?: (
    userId: string,
    rejectedAccessToken: string,
    options: { fetcher: typeof fetch; now: number }
  ) => Promise<{ merchantId: string; accessToken: string }>;
}

interface ProviderErrorDetails {
  code: string | null;
  message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function paginationFromPayload(payload: Record<string, unknown>): SallaPagination {
  const pagination = isRecord(payload.pagination) ? payload.pagination : {};
  return {
    currentPage: numberOrNull(pagination.currentPage),
    totalPages: numberOrNull(pagination.totalPages),
    total: numberOrNull(pagination.total),
  };
}

function providerErrorDetails(payload: unknown): ProviderErrorDetails {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return { code: null, message: null };
  }
  return {
    code: typeof payload.error.code === 'string' ? payload.error.code : null,
    message: typeof payload.error.message === 'string' ? payload.error.message : null,
  };
}

async function readBodyWithinLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      throw new SallaReadError('invalid_response');
    }
    return new TextDecoder().decode(bytes);
  }

  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        try {
          void reader.cancel().catch(() => undefined);
        } catch {
          // The stream is already closed; the size check still fails closed.
        }
        throw new SallaReadError('invalid_response');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function requestPage(
  operation: SallaReadOperation,
  accessToken: string,
  fetcher: typeof fetch
): Promise<SallaListResult> {
  const url = operation === 'products' ? SALLA_PRODUCTS_URL : SALLA_ORDERS_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  let payload: unknown = null;
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    const rawBody = await readBodyWithinLimit(response);
    if (rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody) as unknown;
      } catch {
        throw new SallaReadError('invalid_response');
      }
    }
  } catch (error) {
    if (error instanceof SallaReadError) throw error;
    throw new SallaReadError('provider_error');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) {
      const details = providerErrorDetails(payload);
      if (
        details.code === 'Unauthorized' &&
        details.message === 'The access token is invalid'
      ) {
        throw new SallaReadError('auth_rejected');
      }
      if (
        details.code === 'Unauthorized' &&
        details.message?.startsWith(
          'The access token should have access to one of those scopes:'
        )
      ) {
        throw new SallaReadError('scope_denied');
      }
    }
    throw new SallaReadError('provider_error');
  }

  if (
    !isRecord(payload) ||
    payload.success === false ||
    (typeof payload.status === 'number' &&
      (payload.status < 200 || payload.status >= 300)) ||
    (typeof payload.status === 'string' &&
      payload.status.toLowerCase() !== 'success') ||
    (payload.status !== undefined &&
      typeof payload.status !== 'number' &&
      typeof payload.status !== 'string')
  ) {
    throw new SallaReadError('invalid_response');
  }
  if (!Array.isArray(payload.data)) {
    throw new SallaReadError('invalid_response');
  }

  return {
    records: payload.data as Record<string, unknown>[],
    count: payload.data.length,
    pagination: paginationFromPayload(payload),
  };
}

function defaultResolveAccessToken(
  userId: string,
  options: { fetcher: typeof fetch; now: number }
) {
  return getAuthenticatedSallaAccessToken(userId, options);
}

function defaultRefreshRejectedToken(
  userId: string,
  rejectedAccessToken: string,
  options: { fetcher: typeof fetch; now: number }
) {
  return refreshAuthenticatedSallaAccessTokenForRejectedToken(
    userId,
    rejectedAccessToken,
    options
  );
}

async function list(
  operation: SallaReadOperation,
  userId: string,
  options: ReadClientOptions = {}
): Promise<SallaListResult> {
  const fetcher = options.fetcher || fetch;
  const now = options.now ?? Date.now();
  const resolveAccessToken =
    options.resolveAccessToken || defaultResolveAccessToken;
  const refreshRejectedToken =
    options.refreshRejectedToken || defaultRefreshRejectedToken;

  let credentials: { merchantId: string; accessToken: string };
  try {
    credentials = await resolveAccessToken(userId, { fetcher, now });
  } catch {
    throw new SallaReadError('connection_unavailable');
  }

  try {
    return await requestPage(operation, credentials.accessToken, fetcher);
  } catch (error) {
    if (!(error instanceof SallaReadError) || error.category !== 'auth_rejected') {
      throw error;
    }

    let refreshed: { merchantId: string; accessToken: string };
    try {
      refreshed = await refreshRejectedToken(
        userId,
        credentials.accessToken,
        { fetcher, now: Date.now() }
      );
    } catch {
      throw new SallaReadError('refresh_failed');
    }

    try {
      // This is the sole retry for this read operation.  A second documented
      // invalid-token response is surfaced as auth_rejected and never loops.
      return await requestPage(operation, refreshed.accessToken, fetcher);
    } catch (retryError) {
      throw retryError;
    }
  }
}

export function listProducts(
  userId: string,
  options: ReadClientOptions = {}
): Promise<SallaListResult> {
  return list('products', userId, options);
}

export function listOrders(
  userId: string,
  options: ReadClientOptions = {}
): Promise<SallaListResult> {
  return list('orders', userId, options);
}

export function verificationErrorForRead(error: unknown): string {
  if (!(error instanceof SallaReadError)) {
    return 'Unable to read Salla data';
  }
  switch (error.category) {
    case 'scope_denied':
      return 'Salla read permission denied';
    case 'auth_rejected':
    case 'refresh_failed':
      return 'Salla authorization failed';
    case 'connection_unavailable':
      return 'Salla connection unavailable';
    case 'invalid_response':
    case 'provider_error':
    default:
      return 'Unable to read Salla data';
  }
}