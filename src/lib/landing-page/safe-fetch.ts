import {
  assertPublicStorefrontResolution,
  normalizeTrustedStorefrontOrigin,
  STOREFRONT_FETCH_POLICY,
  validateStorefrontRedirect,
} from '@/lib/salla/storefront-origin';
import { LandingPageFetchError } from './types';

export interface SafeStorefrontDocument {
  origin: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  html: string;
  contentHash: string;
  responseBytes: number;
  redirectCount: number;
  fetchDurationMs: number;
}

export type StorefrontResolver = (
  hostname: string,
  options?: { signal?: AbortSignal }
) => Promise<string[]>;

type DnsJsonAnswer = { type?: unknown; data?: unknown };
type DnsJsonResponse = { Status?: unknown; Answer?: unknown };

async function queryDnsJson(
  hostname: string,
  type: 'A' | 'AAAA',
  signal?: AbortSignal
): Promise<DnsJsonResponse> {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', type);
  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    redirect: 'error',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('DNS lookup failed');
  return response.json() as Promise<DnsJsonResponse>;
}

/**
 * Resolve through a fixed public DoH service before every storefront fetch.
 * The Worker compatibility flag `global_fetch_strictly_public` remains the
 * final resolver-level guard against DNS rebinding between this check and
 * the outbound request.
 */
export async function resolveStorefrontAddresses(
  hostname: string,
  options: { signal?: AbortSignal } = {}
): Promise<string[]> {
  const responses = await Promise.all([
    queryDnsJson(hostname, 'A', options.signal),
    queryDnsJson(hostname, 'AAAA', options.signal),
  ]);
  const addresses: string[] = [];
  for (const response of responses) {
    if (response.Status !== 0 && response.Status !== 3) {
      throw new Error('DNS lookup failed');
    }
    if (!Array.isArray(response.Answer)) continue;
    for (const answer of response.Answer as DnsJsonAnswer[]) {
      if ((answer.type === 1 || answer.type === 28) && typeof answer.data === 'string') {
        addresses.push(answer.data.trim());
      }
    }
  }
  return [...new Set(addresses)];
}

function redirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 ||
    status === 307 || status === 308;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LandingPageFetchError('timeout', 'Storefront request timed out')),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function boundedBody(
  response: Response,
  remainingMs: number,
  controller: AbortController
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > STOREFRONT_FETCH_POLICY.maxHtmlBytes) {
    controller.abort();
    throw new LandingPageFetchError('response_too_large', 'Storefront HTML exceeded the size limit');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await withTimeout(reader.read(), remainingMs);
      if (next.done) break;
      total += next.value.byteLength;
      if (
        total > STOREFRONT_FETCH_POLICY.maxResponseBytes ||
        total > STOREFRONT_FETCH_POLICY.maxHtmlBytes
      ) {
        controller.abort();
        await reader.cancel();
        throw new LandingPageFetchError('response_too_large', 'Storefront HTML exceeded the size limit');
      }
      chunks.push(next.value);
    }
  } catch (error) {
    controller.abort();
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

export async function fetchVerifiedStorefront(
  trustedOrigin: string,
  options: {
    fetcher?: typeof fetch;
    resolver?: StorefrontResolver;
    now?: () => number;
  } = {}
): Promise<SafeStorefrontDocument> {
  const origin = normalizeTrustedStorefrontOrigin(trustedOrigin);
  if (!origin || origin !== trustedOrigin) {
    throw new LandingPageFetchError('invalid_verified_origin', 'Verified storefront origin is invalid');
  }

  const fetcher = options.fetcher ?? fetch;
  const resolver = options.resolver ?? resolveStorefrontAddresses;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + STOREFRONT_FETCH_POLICY.timeoutMs;
  let currentUrl = `${origin}/`;
  let redirectCount = 0;

  while (true) {
    const current = new URL(currentUrl);
    let addresses: string[] = [];
    const dnsRemainingMs = deadline - now();
    if (dnsRemainingMs <= 0) {
      throw new LandingPageFetchError('timeout', 'Storefront request timed out');
    }
    const dnsController = new AbortController();
    try {
      addresses = await withTimeout(
        resolver(current.hostname, { signal: dnsController.signal }),
        dnsRemainingMs
      );
      assertPublicStorefrontResolution(current.hostname, addresses);
    } catch (error) {
      dnsController.abort();
      if (error instanceof LandingPageFetchError) throw error;
      const reason = addresses.length > 0
        ? 'dns_blocked' : 'dns_unavailable';
      throw new LandingPageFetchError(reason, 'Storefront DNS validation failed');
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new LandingPageFetchError('timeout', 'Storefront request timed out');
    }
    const controller = new AbortController();
    let response: Response;
    try {
      response = await withTimeout(
        fetcher(currentUrl, {
          method: 'GET',
          headers: {
            Accept: 'text/html,application/xhtml+xml;q=0.9',
            'User-Agent': 'iSaudi-Landing-Page-Analyzer/1.0',
          },
          redirect: 'manual',
          signal: controller.signal,
          cache: 'no-store',
        }),
        remainingMs
      );
    } catch (error) {
      controller.abort();
      if (error instanceof LandingPageFetchError) throw error;
      throw new LandingPageFetchError('network_error', 'Storefront request failed');
    }

    if (redirectStatus(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new LandingPageFetchError('redirect_blocked', 'Storefront redirect was incomplete');
      }
      if (redirectCount >= STOREFRONT_FETCH_POLICY.maxRedirects) {
        throw new LandingPageFetchError('too_many_redirects', 'Storefront redirect limit exceeded');
      }
      try {
        currentUrl = validateStorefrontRedirect(origin, currentUrl, location);
      } catch {
        throw new LandingPageFetchError('redirect_blocked', 'Storefront redirect left the verified origin');
      }
      redirectCount += 1;
      continue;
    }

    if (!response.ok) {
      throw new LandingPageFetchError('http_status', 'Storefront returned an unsuccessful status', response.status);
    }
    const contentType = (response.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!(STOREFRONT_FETCH_POLICY.contentTypes as readonly string[]).includes(contentType)) {
      throw new LandingPageFetchError('invalid_content_type', 'Storefront response was not HTML', response.status);
    }

    const bodyRemainingMs = deadline - now();
    if (bodyRemainingMs <= 0) {
      throw new LandingPageFetchError('timeout', 'Storefront request timed out');
    }
    const bytes = await boundedBody(response, bodyRemainingMs, controller);
    const html = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return {
      origin,
      finalUrl: currentUrl,
      httpStatus: response.status,
      contentType,
      html,
      contentHash: await sha256(bytes),
      responseBytes: bytes.byteLength,
      redirectCount,
      fetchDurationMs: Math.max(0, now() - startedAt),
    };
  }
}
