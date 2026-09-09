import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { normalizeEmail } from '@/lib/auth/email';
import type { User } from '@/lib/db/client';
import { getDb } from '@/lib/db/client';
import { randomBytes, randomUUID } from 'crypto';
import { sendVerifyEmail } from '@/lib/email/resend';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { evaluateOtpChallenge, limiterDigest, OTP_LIMITS, genericOtpResponse } from '@/lib/auth/otp';

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

export async function POST(request: NextRequest) {
  try {
    let env: any = null;
    try {
      const ctx = getCloudflareContext();
      env = (ctx as any)?.env ?? (ctx as any)?.context?.env ?? null;
    } catch {
      env = null;
    }
    const d1 = env?.DB ?? null;
    const isCloudflare = Boolean(d1) || Boolean((globalThis as any).Cloudflare) || process.env.NEXT_RUNTIME === 'edge';
    const isProd = Boolean((globalThis as any).Cloudflare) || process.env.NODE_ENV === 'production';
    if (isProd && !(env?.OTP_HMAC_SECRET || process.env.OTP_HMAC_SECRET)) {
      return NextResponse.json({ error: 'Authentication unavailable' }, { status: 500 });
    }
    const emailEnv = isCloudflare
      ? {
          RESEND_API_KEY: env?.RESEND_API_KEY ?? null,
          RESEND_FROM: env?.RESEND_FROM ?? null,
          EMAIL_PROVIDER: env?.EMAIL_PROVIDER ?? null,
          DEV_OTP: env?.DEV_OTP ?? null,
        }
      : {
          RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
          RESEND_FROM: process.env.RESEND_FROM ?? null,
          EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? null,
          DEV_OTP: process.env.DEV_OTP ?? null,
        };
    const hasResendKey = Boolean(emailEnv.RESEND_API_KEY);
    const hasResendFrom = Boolean(emailEnv.RESEND_FROM);

    if (env && !d1 && isProd) {
      console.error('D1 binding DB is undefined', {
        hasEnv: !!env,
        keys: env ? Object.keys(env) : [],
      });
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    if (isProd && (!hasResendKey || !hasResendFrom)) {
      return NextResponse.json(
        {
          error: 'Email service not configured',
          hasResendKey,
          hasResendFrom,
        },
        { status: 500 }
      );
    }

    const { email, code } = await request.json();
    const rawCode = code;
    let codeStr = String(rawCode ?? '').trim();
    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const western = '0123456789';
    codeStr = codeStr.replace(/[٠-٩]/g, (ch) => western[arabicIndic.indexOf(ch)] ?? ch);
    const codeStrDigitsOnly = /^[0-9]+$/.test(codeStr);
    
    if (!email || !codeStr) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }
    if (codeStr.length !== 6 || !codeStrDigitsOnly) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const rawEmail = String(email).trim();
    const normalizedEmail = normalizeEmail(rawEmail);
    const ip = isProd
      ? (request.headers.get('cf-connecting-ip') || '').trim()
      : (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'development').split(',')[0].trim();
    if (!ip) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 500 });

    if (d1) {
      const now = Date.now();
      const windowStart = Math.floor(now / (15 * 60 * 1000)) * (15 * 60 * 1000);
      const rate = async (key: string, limit: number, increment = false) => {
        const hash = limiterDigest(key, isProd, env?.OTP_HMAC_SECRET);
        await d1.prepare('DELETE FROM otp_rate_limits WHERE expires_at <= ?').bind(now).run();
        if (!increment) {
          const existing: any = await d1.prepare('SELECT count FROM otp_rate_limits WHERE key_hash = ? AND window_start = ?').bind(hash, windowStart).first();
          return Number(existing?.count || 0) >= limit ? Math.max(1, Math.ceil((windowStart + 15 * 60 * 1000 - now) / 1000)) : 0;
        }
        const updated: any = await d1.prepare(`INSERT INTO otp_rate_limits (key_hash, window_start, expires_at, count) VALUES (?, ?, ?, 1)
          ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`)
          .bind(hash, windowStart, windowStart + 15 * 60 * 1000, limit).first();
        return updated ? 0 : Math.max(1, Math.ceil((windowStart + 15 * 60 * 1000 - now) / 1000));
      };
      const emailRetry = await rate(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail);
      const ipRetry = await rate(`verify-ip:${ip}`, OTP_LIMITS.verifyIp);
      if (emailRetry || ipRetry) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.max(emailRetry, ipRetry)) } });
      }
      const record = (await d1
        .prepare('SELECT * FROM otp_challenges WHERE email = ?')
        .bind(normalizedEmail)
        .first()) as any | null;

      if (!record) {
        await rate(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail, true);
        await rate(`verify-ip:${ip}`, OTP_LIMITS.verifyIp, true);
        return NextResponse.json(genericOtpResponse(), { status: 400 });
      }
      
      const nowSec = Math.floor(Date.now() / 1000);

      if (record.expires_at < nowSec) {
        await rate(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail, true);
        await rate(`verify-ip:${ip}`, OTP_LIMITS.verifyIp, true);
        return NextResponse.json(genericOtpResponse(), { status: 400 });
      }

      if (record.consumed_at) {
        await rate(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail, true);
        await rate(`verify-ip:${ip}`, OTP_LIMITS.verifyIp, true);
        return NextResponse.json(genericOtpResponse(), { status: 400 });
      }
      
      if (record.attempts >= 8) {
        return NextResponse.json(genericOtpResponse(), { status: 400 });
      }
      
      const evaluation = evaluateOtpChallenge(
        record,
        normalizedEmail,
        codeStr,
        nowSec,
        isProd,
        env?.OTP_HMAC_SECRET
      );

      if (!evaluation.valid) {
        await d1
          .prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE email = ? AND attempts < 8')
          .bind(normalizedEmail)
          .run();
        const emailFailure = await rate(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail, true);
        const ipFailure = await rate(`verify-ip:${ip}`, OTP_LIMITS.verifyIp, true);
        if (emailFailure || ipFailure) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.max(emailFailure, ipFailure)) } });
        return NextResponse.json(genericOtpResponse(), { status: 400 });
      }
      
      // Code valid!
      const consumed = await d1
        .prepare('UPDATE otp_challenges SET consumed_at = ? WHERE email = ? AND otp_hash = ? AND attempts < 8 AND consumed_at IS NULL AND expires_at > ?')
        .bind(nowSec, normalizedEmail, evaluation.digest, nowSec)
        .run();
      if (!consumed?.meta?.changes) return NextResponse.json(genericOtpResponse(), { status: 400 });
      
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
            await sendVerifyEmail(user.email, verifyUrl, emailEnv, isProd);
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
        maxAge: 60 * 60 * 24 * 30,
        expires: new Date(expiresAt),
        path: '/',
      });

      return NextResponse.json({ success: true, redirectTo: '/dashboard' });
    }

    if (isCloudflare) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { dbService } = await import('@/lib/db/service');
    const db = await getDb();
    const prepare = db.prepare.bind(db);

    const findUsersByNormalizedEmail = async (normalized: string): Promise<User[]> => {
      const users = await prepare('SELECT *, free_reports_used as freeReportsUsed FROM users')
        .all() as User[];
      return users.filter((u) => normalizeEmail(u.email) === normalized);
    };

    const record = await dbService.getOTP(normalizedEmail);
    const emailRate = await dbService.checkRateLimit(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail);
    const ipRate = await dbService.checkRateLimit(`verify-ip:${ip}`, OTP_LIMITS.verifyIp);
    if (!emailRate.allowed || !ipRate.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.max(emailRate.retryAfter, ipRate.retryAfter)) },
      });
    }
    
    if (!record) {
      await dbService.consumeRateLimit(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail);
      await dbService.consumeRateLimit(`verify-ip:${ip}`, OTP_LIMITS.verifyIp);
      return NextResponse.json(genericOtpResponse(), { status: 400 });
    }
    
    if (record.expires_at < Date.now()) {
      await dbService.consumeRateLimit(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail);
      await dbService.consumeRateLimit(`verify-ip:${ip}`, OTP_LIMITS.verifyIp);
      return NextResponse.json(genericOtpResponse(), { status: 400 });
    }
    
    if (record.attempts >= 8) {
      return NextResponse.json(genericOtpResponse(), { status: 400 });
    }
    
    const evaluation = evaluateOtpChallenge(
      record,
      normalizedEmail,
      codeStr,
      Date.now(),
      isProd
    );
    
    if (!evaluation.valid) {
      await dbService.incrementOTPAttempts(normalizedEmail);
      const emailFailure = await dbService.consumeRateLimit(`verify-email:${normalizedEmail}`, OTP_LIMITS.verifyEmail);
      const ipFailure = await dbService.consumeRateLimit(`verify-ip:${ip}`, OTP_LIMITS.verifyIp);
      if (!emailFailure.allowed || !ipFailure.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.max(emailFailure.retryAfter, ipFailure.retryAfter)) } });
      }
      return NextResponse.json(genericOtpResponse(), { status: 400 });
    }
    
    // Code valid! 
    // 1. Clean up OTP
    const consumed = await dbService.consumeOTP(
      normalizedEmail,
      evaluation.digest,
      Date.now()
    );
    if (!consumed) {
      return NextResponse.json(genericOtpResponse(), { status: 400 });
    }
    
    // 2. Find or Create User
    const matches = await findUsersByNormalizedEmail(normalizedEmail);
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
        const rawUser = await dbService.getUserByEmail(rawEmail);
        if (rawUser) {
          try {
          await prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizedEmail, rawUser.id);
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
      user = await dbService.createUser(normalizedEmail);
    }
    
    // 3. Create Session
    const session = await dbService.createSession(user.id);

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
          await dbService.setEmailVerificationToken(user.id, token, expiresAt);
          const appUrl = resolveAppUrl();
          const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;
          await sendVerifyEmail(user.email, verifyUrl, emailEnv, isProd);
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
