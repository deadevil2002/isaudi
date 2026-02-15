import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/crypto';
import { randomUUID } from 'crypto';

const SALLA_CLIENT_ID = process.env.SALLA_CLIENT_ID;
const SALLA_CLIENT_SECRET = process.env.SALLA_CLIENT_SECRET;
const SALLA_REDIRECT_URL = process.env.SALLA_REDIRECT_URL || 'https://isaudi.ai/api/connect/salla/callback';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/connect/salla?error=' + error, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/connect/salla?error=no_code', request.url));
    }

    if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET) {
      return NextResponse.redirect(new URL('/connect/salla?error=config_missing', request.url));
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
      return NextResponse.redirect(new URL('/connect/salla?error=token_failed', request.url));
    }

    // Get current user from session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = dbService.getSession(sessionId);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
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
    dbService.createOrUpdateStoreConnection({
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

    return NextResponse.redirect(new URL('/dashboard?connected=true', request.url));

  } catch (error) {
    console.error('Salla Callback Error:', error);
    return NextResponse.redirect(new URL('/connect/salla?error=server_error', request.url));
  }
}
