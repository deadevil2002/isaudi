import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { getSallaEnvironment } from '@/lib/salla/environment';
import {
  consumeSallaOAuthState,
  SALLA_OAUTH_STATE_COOKIE,
} from '@/lib/salla/oauth-state';
import {
  buildSallaTokenBody,
  resolveSallaRedirectUri,
} from '@/lib/salla/oauth-urls';

function redirectAndClearState(request: NextRequest, path: string) {
  const origin =
    process.env.NODE_ENV === 'production'
      ? 'https://isaudi.ai'
      : request.nextUrl.origin;
  const response = NextResponse.redirect(new URL(path, origin), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
  response.cookies.set(SALLA_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/api/connect/salla/callback',
  });
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const returnedState = searchParams.get('state');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value ?? null;
    const storedState =
      cookieStore.get(SALLA_OAUTH_STATE_COOKIE)?.value ?? null;
    const { SALLA_CLIENT_ID, SALLA_CLIENT_SECRET, SALLA_REDIRECT_URL } =
      getSallaEnvironment();
    if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET) {
      return redirectAndClearState(
        request,
        '/connect/salla?error=config_missing'
      );
    }

    const validState = await consumeSallaOAuthState({
      returnedState,
      sessionId,
      signingSecret: SALLA_CLIENT_SECRET,
      takeStoredState: () => storedState,
      consumeNonce: (nonceHash, boundSessionId, now) =>
        dbService.consumeSallaOAuthStateNonce(
          nonceHash,
          boundSessionId,
          now
        ),
    });
    if (!validState) {
      return redirectAndClearState(request, '/connect/salla?error=oauth_failed');
    }

    if (!sessionId) {
      return redirectAndClearState(request, '/login');
    }
    const session = await dbService.getSession(sessionId);
    if (!session) {
      return redirectAndClearState(request, '/login');
    }

    if (error) {
      return redirectAndClearState(request, '/connect/salla?error=access_denied');
    }

    if (!code) {
      return redirectAndClearState(request, '/connect/salla?error=no_code');
    }

    // Exchange code for token
    const redirectUri = resolveSallaRedirectUri(
      SALLA_REDIRECT_URL,
      process.env.NODE_ENV === 'production'
    );
    const tokenRes = await fetch('https://accounts.salla.sa/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildSallaTokenBody({
        clientId: SALLA_CLIENT_ID,
        clientSecret: SALLA_CLIENT_SECRET,
        code,
        redirectUri,
      })
    });

    const tokenData = await tokenRes.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
    };

    if (!tokenRes.ok) {
      console.error('Salla token exchange failed', {
        provider: 'salla',
        status: tokenRes.status,
      });
      return redirectAndClearState(request, '/connect/salla?error=token_failed');
    }
    if (
      typeof tokenData.access_token !== 'string' ||
      !tokenData.access_token ||
      typeof tokenData.expires_in !== 'number'
    ) {
      console.error('Salla token exchange returned an invalid response', {
        provider: 'salla',
        status: tokenRes.status,
      });
      return redirectAndClearState(request, '/connect/salla?error=token_failed');
    }

    // Fetch store profile (to get store name/url)
    const userRes = await fetch('https://api.salla.dev/admin/v2/oauth2/user/info', {
      headers: {
       'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    // Fallback if user info fails, just store tokens
    let storeName = 'Salla Store';
    let storeUrl = '';
    
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData.data) {
        storeName = userData.data.name || storeName;
        storeUrl = userData.data.url || '';
        // Could also get merchant info
      }
    }

    // Store connection
    await dbService.createOrUpdateStoreConnection({
      id: randomUUID(),
      userId: session.userId,
      platform: 'salla',
      status: 'connected',
      storeName: storeName,
      storeUrl: storeUrl,
      accessTokenEncrypted: encrypt(tokenData.access_token),
      refreshTokenEncrypted: typeof tokenData.refresh_token === 'string' ? encrypt(tokenData.refresh_token) : null,
      tokenExpiresAt: Date.now() + (tokenData.expires_in * 1000),
      createdAt: Date.now()
    });

    return redirectAndClearState(request, '/dashboard?connected=true');

  } catch {
    console.error('Salla callback failed', { provider: 'salla' });
    return redirectAndClearState(request, '/connect/salla?error=server_error');
  }
}
