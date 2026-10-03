export const BUSINESS_API_SCOPES = [
  'account:read',
  'stores:read',
  'reports:read',
] as const;

export type BusinessApiScope = (typeof BUSINESS_API_SCOPES)[number];

export type BusinessApiErrorCode =
  | 'invalid_request'
  | 'invalid_api_key'
  | 'api_access_not_entitled'
  | 'insufficient_scope'
  | 'not_found'
  | 'rate_limit_exceeded'
  | 'service_unavailable';

export const BUSINESS_API_RATE_LIMIT = {
  key: 120,
  tenant: 300,
  windowMs: 15 * 60 * 1000,
} as const;

export const BUSINESS_API_PAGE_SIZE = { default: 20, max: 50 } as const;

export function apiError(code: BusinessApiErrorCode, message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'private, no-store', ...headers } },
  );
}

export function isBusinessApiScope(value: unknown): value is BusinessApiScope {
  return typeof value === 'string' && BUSINESS_API_SCOPES.includes(value as BusinessApiScope);
}

export function parseScopes(value: string): BusinessApiScope[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isBusinessApiScope) : [];
  } catch {
    return [];
  }
}
