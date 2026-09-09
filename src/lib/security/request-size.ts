export const REQUEST_BODY_LIMITS = {
  auth: 4 * 1024,
  json: 64 * 1024,
  analysis: 256 * 1024,
  webhook: 512 * 1024,
  csvImport: 12 * 1024 * 1024,
} as const;

export class RequestBodyTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = 'RequestBodyTooLargeError';
  }
}

export function contentLengthExceeds(request: Request, limit: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > limit;
}

export async function readBodyWithLimit(request: Request, limit: number): Promise<Uint8Array> {
  if (contentLengthExceeds(request, limit)) {
    throw new RequestBodyTooLargeError(limit);
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RequestBodyTooLargeError(limit);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readTextWithLimit(request: Request, limit: number): Promise<string> {
  return new TextDecoder().decode(await readBodyWithLimit(request, limit));
}

export async function readJsonWithLimit(request: Request, limit: number): Promise<unknown> {
  const text = await readTextWithLimit(request, limit);
  return JSON.parse(text);
}

export function requestTooLargeResponse(): Response {
  return Response.json(
    { error: 'Request body too large' },
    { status: 413, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function requestBodyLimit(pathname: string): number {
  if (pathname.startsWith('/admin/api/')) return REQUEST_BODY_LIMITS.auth;
  if (
    pathname === '/api/auth/request-otp' ||
    pathname === '/api/auth/verify-otp' ||
    pathname === '/api/auth/send-verification' ||
    pathname === '/api/auth/logout'
  ) {
    return REQUEST_BODY_LIMITS.auth;
  }
  if (pathname === '/api/connect/csv/upload') return REQUEST_BODY_LIMITS.csvImport;
  if (pathname === '/api/analysis/chat' || pathname === '/api/analysis/generate') {
    return REQUEST_BODY_LIMITS.analysis;
  }
  if (pathname === '/api/webhooks/salla' || pathname === '/api/billing/tap/webhook') {
    return REQUEST_BODY_LIMITS.webhook;
  }
  return REQUEST_BODY_LIMITS.json;
}

export function bodySizeGuard(request: Request): Response | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null;
  const pathname = new URL(request.url).pathname;
  return contentLengthExceeds(request, requestBodyLimit(pathname))
    ? requestTooLargeResponse()
    : null;
}