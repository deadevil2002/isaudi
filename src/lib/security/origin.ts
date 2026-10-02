import { getRuntimeString } from '@/lib/runtime/environment';

/**
 * Explicit browser state-changing endpoints protected by Origin/Referer.
 */
export const ORIGIN_PROTECTED_POST_PATHS = [
  '/api/auth/logout',
  '/api/auth/send-verification',
  '/api/costs/upsert',
  '/api/connect/csv/upload',
  '/api/connect/salla/link-code',
  '/api/connect/salla/verify',
  '/api/analysis/generate',
  '/api/analysis/chat',
  '/api/analysis/landing-page',
  '/api/reports/generate-weekly',
  '/api/billing/verify',
  '/api/billing/tap/create-payment',
  '/api/dev/set-plan',
] as const;

export const ORIGIN_PROTECTED_METHOD = 'POST' as const;
export const CSRF_PROTECTED_PATHS = ORIGIN_PROTECTED_POST_PATHS;

export const ORIGIN_PROTECTION_EXCLUSIONS = [
  'public OTP endpoints',
  '/api/webhooks/salla',
  '/api/connect/salla/start',
  '/api/connect/salla/callback',
  '/api/webhooks/tap',
  '/api/auth/verify-email',
  'all GET reads',
] as const;

function originFromUrl(value: string, allowPath: boolean): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (!allowPath && url.pathname !== '/' && url.pathname !== '')
    ) {
      return null;
    }
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}

function developmentTrustedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const value of (process.env.DEV_TRUSTED_ORIGINS ?? '').split(',')) {
    const origin = originFromUrl(value.trim(), false);
    if (origin) origins.add(origin);
  }
  return origins;
}

function isTrustedOrigin(
  value: string,
  production: boolean,
  configuredAppUrl?: string
): boolean {
  const origin = originFromUrl(value, false);
  if (!origin) return false;
  if (origin === 'https://isaudi.ai') return true;
  const configuredOrigin = configuredAppUrl
    ? originFromUrl(configuredAppUrl, false)
    : null;
  if (configuredOrigin && origin === configuredOrigin) return true;
  if (production) return false;

  const url = new URL(origin);
  const isLocalhost =
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    (url.protocol === 'http:' || url.protocol === 'https:');
  const isReplitDev =
    url.protocol === 'https:' &&
    url.hostname.endsWith('.replit.dev') &&
    url.hostname.length > '.replit.dev'.length;
  return isLocalhost || isReplitDev || developmentTrustedOrigins().has(origin);
}

/**
 * Returns a 403 response for a protected request with an untrusted origin.
 * The explicit production argument keeps this deterministic in tests.
 */
export function originGuard(
  request: Request,
  production = process.env.NODE_ENV === 'production',
  configuredAppUrl = getRuntimeString('APP_URL')
): Response | null {
  const pathname = new URL(request.url).pathname;
  const isAdminMutation =
    pathname.startsWith('/admin/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (
    !isAdminMutation &&
    (request.method !== ORIGIN_PROTECTED_METHOD ||
      !ORIGIN_PROTECTED_POST_PATHS.includes(
        pathname as (typeof ORIGIN_PROTECTED_POST_PATHS)[number]
      ))
  ) {
    return null;
  }

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const trusted = originHeader
    ? isTrustedOrigin(originHeader, production, configuredAppUrl)
    : refererHeader
      ? isTrustedOrigin(
          originFromUrl(refererHeader.trim(), true) ?? '',
          production,
          configuredAppUrl
        )
      : false;

  return trusted
    ? null
    : new Response('Forbidden', {
        status: 403,
        headers: {
          ...(pathname === '/api/connect/salla/verify'
            ? { 'Cache-Control': 'private, no-store' }
            : {}),
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
}
