import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { dbService } from '@/lib/db/service';
import { db, DB_PATH } from '@/lib/db/client';
import { randomBytes } from 'crypto';
import { sendVerifyEmail } from '@/lib/email/resend';

function resolveAppUrl(): string {
  const fallbackProd = 'https://isaudi.ai';
  const fallbackDev = 'http://localhost:3000';
  const appUrl = process.env.APP_URL ? process.env.APP_URL.trim() : '';
  const cfUrl = process.env.CF_PAGES_URL ? process.env.CF_PAGES_URL.trim() : '';
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
    let generatedNew = false;

    if (!tokenToUse || !expiresAtToUse || expiresAtToUse <= now) {
      tokenToUse = randomBytes(32).toString('hex');
      expiresAtToUse = now + 24 * 60 * 60 * 1000;
      generatedNew = true;
      dbService.setEmailVerificationToken(user.id, tokenToUse, expiresAtToUse);
    }

    try {
      const row = db
        .prepare(
          'SELECT id, email, email_verify_token, email_verify_token_expires_at FROM users WHERE id = ?'
        )
        .get(user.id) as
        | {
            id: string;
            email: string;
            email_verify_token: string | null;
            email_verify_token_expires_at: number | null;
          }
        | undefined;

      console.log('[email-verify] send-verification row', {
        userId: user.id,
        email: user.email,
        tokenPrefix: tokenToUse ? tokenToUse.slice(0, 6) : null,
        expiresAt: expiresAtToUse,
        rowTokenPrefix:
          row && row.email_verify_token ? row.email_verify_token.slice(0, 6) : null,
        rowExpiresAt: row ? row.email_verify_token_expires_at : null,
        columns: [
          'email_verified',
          'email_verified_at',
          'email_verify_token',
          'email_verify_token_expires_at',
        ],
        dbPath: DB_PATH,
        generatedNew,
      });
    } catch (e) {
      console.error('[email-verify] failed to read back verification row', e);
    }

    const appUrl = resolveAppUrl();
    const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(tokenToUse!)}`;

    try {
      await sendVerifyEmail(user.email, verifyUrl);
    } catch (e) {
      console.error('Failed to send verification email', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
