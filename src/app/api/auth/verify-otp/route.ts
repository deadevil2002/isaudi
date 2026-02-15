import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { normalizeEmail } from '@/lib/auth/email';
import { db, User } from '@/lib/db/client';
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

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-key-change-in-prod';

function findUsersByNormalizedEmail(normalizedEmail: string): User[] {
  const users = db
    .prepare('SELECT *, free_reports_used as freeReportsUsed FROM users')
    .all() as User[];
  return users.filter((u) => normalizeEmail(u.email) === normalizedEmail);
}

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const rawEmail = String(email).trim();
    const normalizedEmail = normalizeEmail(rawEmail);

    const record = dbService.getOTP(normalizedEmail);
    
    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    
    if (record.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }
    
    if (record.attempts >= 5) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 400 });
    }
    
    // Verify hash (simple base64 check matching request-otp)
    const inputHash = Buffer.from(code).toString('base64');
    
    if (inputHash !== record.codeHash) {
      dbService.incrementOTPAttempts(normalizedEmail);
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    
    // Code valid! 
    // 1. Clean up OTP
    dbService.deleteOTP(normalizedEmail);
    
    // 2. Find or Create User
    const matches = findUsersByNormalizedEmail(normalizedEmail);
    let user: User | undefined;

    if (matches.length > 1) {
      const sorted = [...matches].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      console.error('Duplicate users with same normalized email', {
        normalizedEmail,
        userIds: sorted.map((u) => u.id),
      });
      user = sorted[0];
    } else if (matches.length === 1) {
      user = matches[0];
    } else {
      const rawUser = dbService.getUserByEmail(rawEmail);
      if (rawUser) {
        try {
          db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizedEmail, rawUser.id);
          user = { ...rawUser, email: normalizedEmail };
        } catch (e) {
          console.error('Failed to normalize user email', {
            rawEmail,
            normalizedEmail,
            userId: rawUser.id,
            error: e,
          });
          user = rawUser;
        }
      }
    }

    if (!user) {
      user = dbService.createUser(normalizedEmail);
    }
    
    // 3. Create Session
    const session = dbService.createSession(user.id);

    if ((user as any).email_verified !== 1) {
      const existingToken = (user as any).email_verify_token as string | null | undefined;
      const existingExpiresAt = (user as any)
        .email_verify_token_expires_at as number | null | undefined;
      const now = Date.now();

      if (existingToken && existingExpiresAt && existingExpiresAt > now) {
        console.log('[email-verify] OTP login: reuse existing active token', {
          userId: user.id,
          tokenPrefix: existingToken.slice(0, 6),
          expiresAt: existingExpiresAt,
        });
      } else {
        const token = randomBytes(32).toString('hex');
        const expiresAt = now + 24 * 60 * 60 * 1000;
        try {
          dbService.setEmailVerificationToken(user.id, token, expiresAt);
          const appUrl = resolveAppUrl();
          const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;
          await sendVerifyEmail(user.email, verifyUrl);
          console.log('[email-verify] OTP login: issued new token', {
            userId: user.id,
            tokenPrefix: token.slice(0, 6),
            expiresAt,
          });
        } catch (e) {
          console.error('Failed to send verification email after OTP login', e);
        }
      }
    }
    
    // 4. Set Cookie
    (await cookies()).set('session_id', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(session.expiresAt),
      path: '/',
    });
    
    return NextResponse.json({ success: true, redirectTo: '/dashboard' });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
