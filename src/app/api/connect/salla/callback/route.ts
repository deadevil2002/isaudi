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

function redirectAndClearState(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
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
    const {
      SALLA_CLIENT_ID,
      SALLA_CLIENT_SECRET,
      SALLA_REDIRECT_URL = 'https://isaudi.ai/api/connect/salla/callback',
    } = getSallaEnvironment();
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
      return redirectAndClearState(request, '/connect/salla?error=oauth_failed');
    }

    if (!code) {
      return redirectAndClearState(request, '/connect/salla?error=oauth_failed');
    }

    // Exchange code for token
    const tokenRes = await fetch('https://accounts.salla.sa/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SALLA_CLIENT_ID,
        client_secret: SALLA_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SALLA_REDIRECT_URL
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Salla Token Error:', tokenData);
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
      refreshTokenEncrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      tokenExpiresAt: Date.now() + (tokenData.expires_in * 1000),
      createdAt: Date.now()
    });

    return redirectAndClearState(request, '/dashboard?connected=true');

  } catch (error) {
    console.error('Salla Callback Error:', error);
    return redirectAndClearState(request, '/connect/salla?error=server_error');
  }
}
