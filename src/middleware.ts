import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { originGuard } from './lib/security/origin';
import { bodySizeGuard } from './lib/security/request-size';

const CANONICAL_ORIGIN = 'https://isaudi.ai';

function requestScheme(request: NextRequest): string {
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
  return request.nextUrl.hostname.toLowerCase().replace(/:\d+$/, '');
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function adminHeaders(request: NextRequest, response: NextResponse | Response) {
  const isAdmin =
    request.nextUrl.pathname === '/admin' ||
    request.nextUrl.pathname.startsWith('/admin/');

  response.headers.set(
    'Referrer-Policy',
    isAdmin ? 'no-referrer' : 'strict-origin-when-cross-origin'
  );

  if (isAdmin) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

function isSensitivePath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/settings' ||
    pathname === '/billing'
  );
}

export function middleware(request: NextRequest) {
  const bodySizeBlock = bodySizeGuard(request);
  if (bodySizeBlock) return adminHeaders(request, bodySizeBlock);

  const originBlock = originGuard(request);
  if (originBlock) return adminHeaders(request, originBlock);

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
      return adminHeaders(request, noStore(NextResponse.redirect(canonicalUrl, 308)));
    }
  }
  
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('session_id');
    if (!session) {
      const loginUrl =
        process.env.NODE_ENV === 'production'
          ? new URL('/login', CANONICAL_ORIGIN)
          : new URL('/login', request.url);
      return adminHeaders(request, noStore(NextResponse.redirect(loginUrl)));
    }
  }
  
  const response = NextResponse.next();
  return adminHeaders(
    request,
    isSensitivePath(request.nextUrl.pathname) ? noStore(response) : response
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
