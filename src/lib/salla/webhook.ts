import { normalizeEmail } from '@/lib/auth/email';
import { encryptSallaToken } from './token-crypto';
import { SALLA_USER_INFO_URL } from './constants';
import {
  applySallaLifecycle,
  claimSallaMerchantByLinkCode,
  upsertSallaAuthorization,
} from './repository';
import { hashSallaLinkCode } from './link-code';
import type { SallaAuthorizer } from './types';

type JsonObject = Record<string, unknown>;

export class SallaWebhookValidationError extends Error {
  constructor(message = 'Malformed Salla webhook') {
    super(message);
    this.name = 'SallaWebhookValidationError';
  }
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject : null;
}

function nonEmpty(value: unknown): string | null {
  if ((typeof value === 'string' || typeof value === 'number') &&
      String(value).trim()) return String(value).trim();
  return null;
}

function merchantId(payload: JsonObject): string | null {
  const data = object(payload.data);
  const merchant = object(payload.merchant) || object(data?.merchant);
  return nonEmpty(payload.merchant) || nonEmpty(payload.merchant_id) ||
    nonEmpty(data?.merchant_id) || nonEmpty(merchant?.id);
}

function settingsMerchantId(payload: JsonObject): string | null {
  return nonEmpty(payload.merchant);
}

function eventTime(payload: JsonObject): number | null {
  const raw = payload.created_at ?? payload.createdAt;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isSafeInteger(numeric) && numeric > 0) {
        return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
      }
      return null;
    }
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function tokenExpiry(data: JsonObject): number | null {
  if (data.expires_in !== undefined) {
    const seconds = typeof data.expires_in === 'number'
      ? data.expires_in : Number(data.expires_in);
    return Number.isFinite(seconds) && seconds > 0
      ? Date.now() + seconds * 1000 : null;
  }
  const raw = data.expires;
  if (typeof raw === 'string' && !/^\d+(?:\.\d+)?$/.test(raw.trim())) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) && parsed > Date.now() ? parsed : null;
  }
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Easy Mode examples use an absolute Unix expiry, while some compatible
  // payloads use a relative number of seconds.
  if (numeric >= 1_000_000_000) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  return Date.now() + numeric * 1000;
}

async function fetchAuthorizer(
  accessToken: string,
  fetcher: typeof fetch,
  expectedMerchantId: string
): Promise<SallaAuthorizer> {
  const response = await fetcher(SALLA_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Salla authorizer lookup failed');
  const body = object(await response.json());
  const data = object(body?.data) || body;
  const user = object(data?.user) || data;
  const email = nonEmpty(user?.email);
  if (!email || !email.includes('@')) {
    throw new SallaWebhookValidationError('Invalid Salla authorizer');
  }
  const responseMerchant = object(data?.merchant) || object(user?.merchant);
  const responseMerchantId = nonEmpty(responseMerchant?.id);
  if (responseMerchantId && responseMerchantId !== expectedMerchantId) {
    throw new SallaWebhookValidationError('Salla merchant identity mismatch');
  }
  return {
    id: nonEmpty(user?.id),
    email: normalizeEmail(email),
    name: nonEmpty(user?.name),
    role: nonEmpty(user?.role),
  };
}

export async function processSallaWebhook(
  value: unknown,
  options: {
    fetcher?: typeof fetch;
    upsertAuthorization?: typeof upsertSallaAuthorization;
    applyLifecycle?: typeof applySallaLifecycle;
    encryptToken?: typeof encryptSallaToken;
    claimMerchant?: (
      merchantId: string,
      codeHash: string,
      eventAt: number,
      now: number
    ) => Promise<'claimed' | 'invalid' | 'conflict'>;
    hashLinkCode?: typeof hashSallaLinkCode;
    now?: () => number;
  } = {}
): Promise<'mutated' | 'ignored'> {
  const payload = object(value);
  if (!payload || typeof payload.event !== 'string' || !payload.event.trim()) {
    throw new SallaWebhookValidationError();
  }
  const event = payload.event.trim();
  const relevant = new Set([
    'app.store.authorize',
    'app.installed',
    'app.updated',
    'app.uninstalled',
    'app.store.deauthorize',
    'app.settings.updated',
  ]);
  if (!relevant.has(event)) return 'ignored';
  const id = event === 'app.settings.updated'
    ? settingsMerchantId(payload)
    : merchantId(payload);
  if (!id) throw new SallaWebhookValidationError('Malformed Salla lifecycle webhook');
  const at = eventTime(payload);
  if (!at) throw new SallaWebhookValidationError('Invalid Salla event timestamp');

  if (event === 'app.settings.updated') {
    const data = object(payload.data);
    const settings = object(data?.settings);
    const rawCode = settings?.isaudi_link_code;
    if (rawCode === undefined) return 'ignored';
    const codeHash = (options.hashLinkCode || hashSallaLinkCode)(rawCode);
    if (!codeHash) return 'ignored';
    const result = await (
      options.claimMerchant || claimSallaMerchantByLinkCode
    )(id, codeHash, at, (options.now || Date.now)());
    return result === 'claimed' ? 'mutated' : 'ignored';
  }

  if (event !== 'app.store.authorize') {
    await (options.applyLifecycle || applySallaLifecycle)(
      id,
      event as 'app.installed' | 'app.updated' | 'app.uninstalled' | 'app.store.deauthorize',
      at
    );
    return 'mutated';
  }

  const data = object(payload.data);
  const accessToken = nonEmpty(data?.access_token);
  const refreshToken = nonEmpty(data?.refresh_token);
  const scopeValue = data?.scope ?? data?.scopes;
  const scopes = Array.isArray(scopeValue)
    ? scopeValue.filter((item) => typeof item === 'string').join(' ')
    : nonEmpty(scopeValue);
  const tokenExpiresAt = data ? tokenExpiry(data) : null;
  if (!accessToken || !refreshToken || !scopes ||
      !tokenExpiresAt) {
    throw new SallaWebhookValidationError('Malformed Salla authorization webhook');
  }

  const authorizer = await fetchAuthorizer(
    accessToken,
    options.fetcher || fetch,
    id
  );
  const encryptToken = options.encryptToken || encryptSallaToken;
  await (options.upsertAuthorization || upsertSallaAuthorization)({
    merchantId: id,
    accessTokenEncrypted: encryptToken(accessToken),
    refreshTokenEncrypted: encryptToken(refreshToken),
    tokenExpiresAt,
    scopes,
    authorizer,
    eventAt: at,
  });
  return 'mutated';
}