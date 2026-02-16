import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { normalizeEmail } from '@/lib/auth/email';
import type { User } from '@/lib/db/client';
import { randomBytes, randomUUID } from 'crypto';
import { sendVerifyEmail } from '@/lib/email/resend';
import { getCloudflareContext } from '@opennextjs/cloudflare';

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

export async function POST(request: NextRequest) {
  try {
    let env: any = null;
    try {
      const ctx = getCloudflareContext();
      env = ctx?.env ?? null;
    } catch {
      env = null;
    }
    const d1 = env?.DB ?? null;
    const resendApiKey = env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? null;
    const resendFrom = env?.RESEND_FROM ?? 'iSaudi <no-reply@updates.isaudi.ai>';
    const emailProvider = env?.EMAIL_PROVIDER ?? process.env.EMAIL_PROVIDER ?? null;
    const devOtp = env?.DEV_OTP === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    const isCloudflare = Boolean(d1) || Boolean((globalThis as any).Cloudflare) || process.env.NEXT_RUNTIME === 'edge';

    if (env && !d1 && isProd) {
      console.error('D1 binding DB is undefined', {
        hasEnv: !!env,
        keys: env ? Object.keys(env) : [],
      });
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const rawEmail = String(email).trim();
    const normalizedEmail = normalizeEmail(rawEmail);

    if (d1) {
      const record = (await d1
        .prepare('SELECT * FROM otp_codes WHERE email = ?')
        .bind(normalizedEmail)
        .first()) as any | null;
      
      if (!record) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
      }
      
      const nowSec = Math.floor(Date.now() / 1000);

      if (record.expires_at < nowSec) {
        return NextResponse.json({ error: 'Code expired' }, { status: 400 });
      }

      if (record.consumed_at) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
      }
      
      if (record.attempts >= 5) {
        return NextResponse.json({ error: 'Too many attempts' }, { status: 400 });
      }
      
      // Verify hash (simple base64 check matching request-otp)
      const inputHash = Buffer.from(code).toString('base64');
      const storedHash = record.codeHash ?? null;
      const storedCode = record.code ?? null;

      if ((storedHash && inputHash !== storedHash) || (!storedHash && storedCode !== code)) {
        await d1
          .prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?')
          .bind(normalizedEmail)
          .run();
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
      }
      
      // Code valid!
      await d1
        .prepare('UPDATE otp_codes SET consumed_at = ? WHERE email = ?')
        .bind(nowSec, normalizedEmail)
        .run();
      
      // 2. Find or Create User
      const usersResult = await d1
        .prepare('SELECT *, free_reports_used as freeReportsUsed FROM users')
        .all();
      const users = (usersResult?.results ?? []) as User[];
      const matches = users.filter((u) => normalizeEmail(String(u.email || '')) === normalizedEmail);
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
        const rawUser = (await d1
          .prepare('SELECT *, free_reports_used as freeReportsUsed FROM users WHERE email = ?')
          .bind(rawEmail)
          .first()) as User | null;
        if (rawUser) {
          try {
            await d1
              .prepare('UPDATE users SET email = ? WHERE id = ?')
              .bind(normalizedEmail, rawUser.id)
              .run();
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
        const id = randomUUID();
        const createdAt = Date.now();
        user = {
          id,
          email: normalizedEmail,
          plan: 'free',
          planExpiresAt: null,
          createdAt,
          freeReportsUsed: 0,
        } as User;
        await d1
          .prepare(
            'INSERT INTO users (id, email, plan, planExpiresAt, createdAt, free_reports_used) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(user.id, user.email, user.plan, user.planExpiresAt, user.createdAt, user.freeReportsUsed ?? 0)
          .run();
      }

      // 3. Create Session
      const sessionId = randomBytes(32).toString('hex');
      const createdAt = Date.now();
      const expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;
      await d1
        .prepare('INSERT INTO sessions (sessionId, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)')
        .bind(sessionId, user.id, expiresAt, createdAt)
        .run();

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
            await d1
              .prepare('UPDATE users SET email_verify_token = ?, email_verify_token_expires_at = ? WHERE id = ?')
              .bind(token, expiresAt, user.id)
              .run();
            const appUrl = resolveAppUrl();
            const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;
            await sendVerifyEmail(user.email, verifyUrl, {
              resendApiKey,
              resendFrom,
              emailProvider,
              devOtp,
            });
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

      (await cookies()).set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(expiresAt),
        path: '/',
      });

      return NextResponse.json({ success: true, redirectTo: '/dashboard' });
    }

    if (isCloudflare) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { dbService } = await import('@/lib/db/service');
    const { db } = await import('@/lib/db/client');

    const findUsersByNormalizedEmail = (normalized: string): User[] => {
      const users = db
        .prepare('SELECT *, free_reports_used as freeReportsUsed FROM users')
        .all() as User[];
      return users.filter((u) => normalizeEmail(u.email) === normalized);
    };

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
          await sendVerifyEmail(user.email, verifyUrl, {
            resendApiKey,
            resendFrom,
            emailProvider,
            devOtp,
          });
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
