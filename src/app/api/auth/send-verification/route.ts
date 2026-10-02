import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { dbService } from '@/lib/db/service';
import { randomBytes } from 'crypto';
import { sendVerifyEmail } from '@/lib/email/resend';
import {
  getRuntimeEnvironment,
  getRuntimeString,
} from '@/lib/runtime/environment';

function resolveAppUrl(): string {
  const fallbackProd = 'https://isaudi.ai';
  const fallbackDev = 'http://localhost:3000';
  const appUrl = getRuntimeString('APP_URL') ?? '';
  const cfUrl = getRuntimeString('CF_PAGES_URL') ?? '';
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

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email_verified === 1) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const existingToken = user.email_verify_token;
    const existingExpiresAt = user.email_verify_token_expires_at;
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

    const runtimeEnv = getRuntimeEnvironment();
    const isProd = Boolean(runtimeEnv.DB) || process.env.NODE_ENV === 'production';
    try {
      await sendVerifyEmail(
        user.email,
        verifyUrl,
        {
          RESEND_API_KEY: getRuntimeString('RESEND_API_KEY'),
          RESEND_FROM: getRuntimeString('RESEND_FROM'),
          EMAIL_PROVIDER: getRuntimeString('EMAIL_PROVIDER'),
          DEV_OTP: getRuntimeString('DEV_OTP'),
        },
        isProd
      );
    } catch {
      console.error('[email-verify] verification email delivery failed');
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Send verification failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
