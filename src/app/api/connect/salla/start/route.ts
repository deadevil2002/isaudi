import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/utils';
import { dbService } from '@/lib/db/service';
import { getSallaEnvironment } from '@/lib/salla/environment';
import {
  createSallaOAuthState,
  SALLA_OAUTH_STATE_COOKIE,
  SALLA_OAUTH_STATE_TTL_SECONDS,
} from '@/lib/salla/oauth-state';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (!user || !sessionId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const {
    SALLA_CLIENT_ID,
    SALLA_CLIENT_SECRET,
    SALLA_REDIRECT_URL = 'https://isaudi.ai/api/connect/salla/callback',
  } = getSallaEnvironment();
  if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Salla OAuth is not configured' }, { status: 500 });
  }

  // Scopes needed for read-only access
  const scopes = 'products.read orders.read offline_access';
  const challenge = createSallaOAuthState(sessionId, SALLA_CLIENT_SECRET);
  await dbService.createSallaOAuthStateNonce(
    challenge.nonceHash,
    sessionId,
    challenge.expiresAt
  );
  const sallaAuthUrl = new URL('https://accounts.salla.sa/oauth2/auth');
  sallaAuthUrl.searchParams.set('client_id', SALLA_CLIENT_ID);
  sallaAuthUrl.searchParams.set('redirect_uri', SALLA_REDIRECT_URL);
  sallaAuthUrl.searchParams.set('response_type', 'code');
  sallaAuthUrl.searchParams.set('scope', scopes);
  sallaAuthUrl.searchParams.set('state', challenge.state);

  const response = NextResponse.redirect(sallaAuthUrl);
  response.cookies.set(SALLA_OAUTH_STATE_COOKIE, challenge.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SALLA_OAUTH_STATE_TTL_SECONDS,
    expires: new Date(challenge.expiresAt),
    path: '/api/connect/salla/callback',
  });
  return response;
}
