import { promises as dnsPromises } from 'node:dns';
import { isIP } from 'node:net';
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

export type WorkersDnsPromises = {
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
  resolveCname?(hostname: string): Promise<string[]>;
};

const MAX_CNAME_HOPS = 5;

function normalizeDnsAlias(value: string): string {
  const origin = normalizeTrustedStorefrontOrigin(
    `https://${value.replace(/\.$/, '')}`
  );
  if (!origin) {
    throw new LandingPageFetchError(
      'dns_no_public_address',
      'Storefront DNS alias was not a public hostname'
    );
  }
  return new URL(origin).hostname;
}

type DnsFailure = { code: string; message: string };

function dnsFailure(error: unknown): DnsFailure {
  if (!error || typeof error !== 'object') {
    return { code: '', message: String(error) };
  }
  const value = error as { code?: unknown; message?: unknown };
  return {
    code: typeof value.code === 'string' ? value.code.toUpperCase() : '',
    message: typeof value.message === 'string' ? value.message : '',
  };
}

function dnsError(
  failures: DnsFailure[]
): LandingPageFetchError {
  if (failures.some(({ code, message }) =>
    code === 'ERR_NOT_IMPLEMENTED' || code === 'ENOSYS' || /not implemented/i.test(message)
  )) {
    return new LandingPageFetchError(
      'dns_unsupported_runtime',
      'The Worker runtime does not support the selected DNS resolver'
    );
  }
  if (failures.some(({ code }) =>
    code === 'ETIMEOUT' || code === 'EAI_AGAIN' || code === 'ESERVFAIL'
  )) {
    return new LandingPageFetchError('dns_timeout', 'Storefront DNS lookup timed out');
  }
  if (failures.length > 0 && failures.every(({ code }) => code === 'ENOTFOUND')) {
    return new LandingPageFetchError('dns_nxdomain', 'Storefront hostname does not exist');
  }
  if (failures.length > 0 && failures.every(({ code }) =>
    code === 'ENODATA' || code === 'ENOTFOUND'
  )) {
    return new LandingPageFetchError(
      'dns_no_public_address',
      'Storefront hostname has no A or AAAA records'
    );
  }
  return new LandingPageFetchError('dns_resolution_error', 'Storefront DNS lookup failed');
}

export function createStorefrontResolver(
  dns: WorkersDnsPromises = dnsPromises
): StorefrontResolver {
  const resolveHostname = async (
    hostname: string,
    visited: Set<string>,
    depth: number
  ): Promise<string[]> => {
    const normalizedOrigin = normalizeTrustedStorefrontOrigin(`https://${hostname}`);
    if (!normalizedOrigin) {
      throw new LandingPageFetchError(
        'dns_no_public_address',
        'Storefront DNS alias was not a public hostname'
      );
    }
    const normalizedHostname = new URL(normalizedOrigin).hostname;
    if (visited.has(normalizedHostname) || depth > MAX_CNAME_HOPS) {
      throw new LandingPageFetchError(
        'dns_resolution_error',
        'Storefront DNS alias chain was invalid'
      );
    }
    visited.add(normalizedHostname);

    const results = await Promise.all([
      dns.resolve4(normalizedHostname).then(
        (addresses) => ({ addresses, failure: null }),
        (error: unknown) => ({ addresses: [] as string[], failure: dnsFailure(error) })
      ),
      dns.resolve6(normalizedHostname).then(
        (addresses) => ({ addresses, failure: null }),
        (error: unknown) => ({ addresses: [] as string[], failure: dnsFailure(error) })
      ),
    ]);
    const records = [
      ...new Set(
        results.flatMap((result) => result.addresses)
          .map((record) => String(record).trim())
      ),
    ];
    const addresses = records.filter((record) => isIP(record) !== 0);
    const inlineAliases = records
      .filter((record) => isIP(record) === 0)
      .map(normalizeDnsAlias);
    if (addresses.length > 0) return addresses;

    let aliases: string[] = [];
    if (dns.resolveCname && depth < MAX_CNAME_HOPS) {
      aliases = await dns.resolveCname(normalizedHostname).catch(() => [] as string[]);
      const normalizedAliases = [
        ...new Set([...inlineAliases, ...aliases.map(normalizeDnsAlias)]),
      ];
      if (normalizedAliases.length > 0) {
        const resolved = await Promise.all(normalizedAliases.map((alias) =>
          resolveHostname(alias, new Set(visited), depth + 1)
        ));
        return [...new Set(resolved.flat())];
      }
    }

    const failures = results.flatMap((result) => result.failure ? [result.failure] : []);
    if (failures.length === 0) {
      throw new LandingPageFetchError(
        'dns_no_public_address',
        'Storefront hostname has no A or AAAA records'
      );
    }
    throw dnsError(failures);
  };

  return (hostname) => resolveHostname(hostname, new Set(), 0);
}

/**
 * Resolve through the Workers-supported node:dns resolve4/resolve6 APIs.
 * This rejects every non-public answer, including mixed public/private sets.
 * Workers does not expose destination-IP pinning for fetch(), so the lookup
 * and request cannot be cryptographically bound. `global_fetch_strictly_public`
 * is therefore retained as the runtime-level backstop against private origins;
 * it does not replace URL, DNS answer, or redirect validation.
 */
export async function resolveStorefrontAddresses(
  hostname: string
): Promise<string[]> {
  return createStorefrontResolver()(hostname);
}

function redirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 ||
    status === 307 || status === 308;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new LandingPageFetchError('fetch_timeout', 'Storefront request timed out')
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(timeoutError),
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
      throw new LandingPageFetchError('dns_timeout', 'Storefront DNS lookup timed out');
    }
    const dnsController = new AbortController();
    try {
      addresses = await withTimeout(
        resolver(current.hostname, { signal: dnsController.signal }),
        dnsRemainingMs,
        new LandingPageFetchError('dns_timeout', 'Storefront DNS lookup timed out')
      );
      assertPublicStorefrontResolution(current.hostname, addresses);
    } catch (error) {
      dnsController.abort();
      if (error instanceof LandingPageFetchError) throw error;
      throw new LandingPageFetchError(
        addresses.length > 0 ? 'dns_no_public_address' : 'dns_resolution_error',
        'Storefront DNS validation failed'
      );
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new LandingPageFetchError('fetch_timeout', 'Storefront request timed out');
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
      throw new LandingPageFetchError('fetch_network_error', 'Storefront request failed');
    }

    if (redirectStatus(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new LandingPageFetchError('redirect_rejected', 'Storefront redirect was incomplete');
      }
      if (redirectCount >= STOREFRONT_FETCH_POLICY.maxRedirects) {
        throw new LandingPageFetchError('too_many_redirects', 'Storefront redirect limit exceeded');
      }
      try {
        currentUrl = validateStorefrontRedirect(origin, currentUrl, location);
      } catch {
        throw new LandingPageFetchError('redirect_rejected', 'Storefront redirect left the verified origin');
      }
      redirectCount += 1;
      continue;
    }

    if (!response.ok) {
      throw new LandingPageFetchError('http_error', 'Storefront returned an unsuccessful status', response.status);
    }
    const contentType = (response.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!(STOREFRONT_FETCH_POLICY.contentTypes as readonly string[]).includes(contentType)) {
      throw new LandingPageFetchError('content_type_rejected', 'Storefront response was not HTML', response.status);
    }

    const bodyRemainingMs = deadline - now();
    if (bodyRemainingMs <= 0) {
      throw new LandingPageFetchError('fetch_timeout', 'Storefront request timed out');
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
