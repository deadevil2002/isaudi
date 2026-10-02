import { isIP } from 'node:net';

export const SALLA_STOREFRONT_ORIGIN_SOURCE =
  'salla.oauth2.user_info.merchant.domain';
export const SALLA_STOREFRONT_VERIFICATION_VERSION =
  'salla_user_info_v1';

export const STOREFRONT_FETCH_POLICY = Object.freeze({
  protocol: 'https:' as const,
  maxRedirects: 3,
  timeoutMs: 10_000,
  maxResponseBytes: 2 * 1024 * 1024,
  maxHtmlBytes: 1024 * 1024,
  contentTypes: ['text/html', 'application/xhtml+xml'] as const,
});

const INTERNAL_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);
const INTERNAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
  '.localdomain',
];

function normalizeHostname(value: string): string | null {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    !hostname ||
    hostname.length > 253 ||
    hostname.includes('%') ||
    hostname.split('.').some((label) =>
      !label ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    return null;
  }
  return hostname;
}

export function isInternalStorefrontHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || !hostname.includes('.')) return true;
  return INTERNAL_HOSTS.has(hostname) ||
    INTERNAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/** Accept only an HTTPS public hostname asserted by Salla. */
export function normalizeTrustedStorefrontOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(raw)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== STOREFRONT_FETCH_POLICY.protocol ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isIP(hostname) !== 0 || isInternalStorefrontHostname(hostname)) {
    return null;
  }
  return `https://${hostname}`;
}

/**
 * Preserve the meaningful storefront path returned by Salla's authenticated
 * Store Information API while removing query, fragment, and trailing slash.
 */
export function normalizeTrustedStorefrontUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(raw)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== STOREFRONT_FETCH_POLICY.protocol ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isIP(hostname) !== 0 || isInternalStorefrontHostname(hostname)) {
    return null;
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `https://${hostname}${pathname}`;
}

export function normalizeTrustedStoreName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return normalized ? normalized.slice(0, 200) : null;
}

function publicIpv4(value: string): boolean {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) =>
    !Number.isInteger(part) || part < 0 || part > 255
  )) return false;
  const [a, b, c] = parts;
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  ) return false;
  return true;
}

function ipv6Words(value: string): number[] | null {
  const input = value.toLowerCase().split('%')[0];
  if (!input || input.split('::').length > 2) return null;
  const [leftRaw, rightRaw = ''] = input.split('::');

  function words(raw: string): number[] | null {
    if (!raw) return [];
    const segments = raw.split(':');
    const result: number[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.includes('.')) {
        if (index !== segments.length - 1 || !publicIpv4(segment)) return null;
        const octets = segment.split('.').map(Number);
        result.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        continue;
      }
      if (!/^[a-f0-9]{1,4}$/.test(segment)) return null;
      result.push(Number.parseInt(segment, 16));
    }
    return result;
  }

  const left = words(leftRaw);
  const right = words(rightRaw);
  if (!left || !right) return null;
  if (!input.includes('::')) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array<number>(missing).fill(0), ...right];
}

function publicIpv6(value: string): boolean {
  const words = ipv6Words(value);
  if (!words) return false;
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  if (allZero || loopback) return false;
  if ((words[0] & 0xfe00) === 0xfc00) return false;
  if ((words[0] & 0xffc0) === 0xfe80) return false;
  if ((words[0] & 0xff00) === 0xff00) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false;

  const mappedIpv4 = words.slice(0, 5).every((word) => word === 0) &&
    words[5] === 0xffff;
  if (mappedIpv4) {
    return publicIpv4([
      words[6] >> 8,
      words[6] & 0xff,
      words[7] >> 8,
      words[7] & 0xff,
    ].join('.'));
  }
  return true;
}

export function isPublicStorefrontAddress(value: string): boolean {
  const version = isIP(value);
  if (version === 4) return publicIpv4(value);
  if (version === 6) return publicIpv6(value);
  return false;
}

export function assertPublicStorefrontResolution(
  hostname: string,
  addresses: readonly string[]
): void {
  const normalized = normalizeHostname(hostname);
  if (
    !normalized ||
    isInternalStorefrontHostname(normalized) ||
    addresses.length === 0 ||
    addresses.some((address) => !isPublicStorefrontAddress(address))
  ) {
    throw new Error('Storefront hostname did not resolve exclusively to public addresses');
  }
}

/** Every redirect remains HTTPS and on the Salla-verified origin. */
export function validateStorefrontRedirect(
  trustedOrigin: string,
  currentUrl: string,
  location: string
): string {
  const normalizedTrusted = normalizeTrustedStorefrontOrigin(trustedOrigin);
  if (!normalizedTrusted) throw new Error('Invalid trusted storefront origin');
  let next: URL;
  try {
    next = new URL(location, currentUrl);
  } catch {
    throw new Error('Invalid storefront redirect');
  }
  if (
    next.protocol !== 'https:' ||
    next.username ||
    next.password ||
    next.port ||
    next.origin.toLowerCase() !== normalizedTrusted
  ) {
    throw new Error('Storefront redirect left the trusted origin');
  }
  next.hash = '';
  return next.href;
}
