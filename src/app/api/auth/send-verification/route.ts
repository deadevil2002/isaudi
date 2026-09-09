import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { dbService } from '@/lib/db/service';
import { randomBytes } from 'crypto';
import { sendVerifyEmail } from '@/lib/email/resend';

function resolveAppUrl(): string {
  const fallbackProd = 'https://isaudi.ai';
  const fallbackDev = 'http://localhost:3000';
  const appUrl = process.env.APP_URL ? process.env.APP_URL.trim() : '';
  const cfUrl = process.env.CF_PAGES_URL ? process.env.CF_PAGES_URL.trim() : '';
  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn('[config] APP_URL points to localhost while NODE_ENV=production');
  }
  const base =
    appUrl || cfUrl || (process.env.NODE_ENV === 'production' ? fallbackProd : fallbackDev);
  try {
    const url = new URL(base);
    return url.origin.replace(/\/+$/, '');
  } catch {
    return process.env.NODE_ENV === 'production' ? fallbackProd : fallbackDev;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((user as any).email_verified === 1) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const existingToken = (user as any).email_verify_token as string | null | undefined;
    const existingExpiresAt = (user as any)
      .email_verify_token_expires_at as number | null | undefined;
    const now = Date.now();

    let tokenToUse = existingToken || null;
    let expiresAtToUse = existingExpiresAt || null;
    if (!tokenToUse || !expiresAtToUse || expiresAtToUse <= now) {
      tokenToUse = randomBytes(32).toString('hex');
      expiresAtToUse = now + 24 * 60 * 60 * 1000;
      await dbService.setEmailVerificationToken(user.id, tokenToUse, expiresAtToUse);
    }

    const appUrl = resolveAppUrl();
    const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(tokenToUse!)}`;

    try {
      await sendVerifyEmail(user.email, verifyUrl);
    } catch {
      console.error('Failed to send verification email');
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Send verification failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
