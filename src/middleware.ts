import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_ORIGIN = 'https://isaudi.ai';

function firstHeaderValue(value: string | null): string {
  return value?.split(',', 1)[0]?.trim().toLowerCase() ?? '';
}

function requestScheme(request: NextRequest): string {
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'));
  if (forwardedProto) return forwardedProto;

  const cfVisitor = request.headers.get('cf-visitor');
  if (cfVisitor) {
    try {
      const scheme = JSON.parse(cfVisitor)?.scheme;
      if (typeof scheme === 'string') return scheme.toLowerCase();
    } catch {
      // Ignore malformed edge metadata and fall back to the request URL.
    }
  }

  return request.nextUrl.protocol.replace(':', '').toLowerCase();
}

function requestHost(request: NextRequest): string {
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const host =
    forwardedHost ||
    firstHeaderValue(request.headers.get('host')) ||
    request.nextUrl.hostname.toLowerCase();
  return host.replace(/:\d+$/, '');
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const scheme = requestScheme(request);
    const host = requestHost(request);

    if (
      (host === 'isaudi.ai' && scheme !== 'https') ||
      host === 'www.isaudi.ai'
    ) {
      const canonicalUrl = new URL(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        CANONICAL_ORIGIN
      );
      return NextResponse.redirect(canonicalUrl, 308);
    }
  }
  
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('session_id');
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
