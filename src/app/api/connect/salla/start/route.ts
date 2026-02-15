import { NextRequest, NextResponse } from 'next/server';

const SALLA_CLIENT_ID = process.env.SALLA_CLIENT_ID;
const SALLA_REDIRECT_URL = process.env.SALLA_REDIRECT_URL || 'https://isaudi.ai/api/connect/salla/callback';

export async function GET(request: NextRequest) {
  if (!SALLA_CLIENT_ID) {
    return NextResponse.json({ error: 'Salla Client ID not configured' }, { status: 500 });
  }

  // Scopes needed for read-only access
  const scopes = 'products.read orders.read offline_access';
  
  const sallaAuthUrl = `https://accounts.salla.sa/oauth2/auth?client_id=${SALLA_CLIENT_ID}&redirect_uri=${encodeURIComponent(SALLA_REDIRECT_URL)}&response_type=code&scope=${encodeURIComponent(scopes)}`;

  return NextResponse.redirect(sallaAuthUrl);
}
