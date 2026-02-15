import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // We can add global middleware logic here if needed.
  // Currently, the dashboard protection is handled in the page.tsx (Server Component)
  // which is often simpler for standard auth patterns in Next.js App Router.
  // However, redirecting at middleware is faster.
  
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('session_id');
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
