import { NextRequest, NextResponse } from 'next/server';
import { sendOTPEmail } from '@/lib/email/sender';
import { randomInt } from 'crypto';
import { normalizeEmail } from '@/lib/auth/email';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BUILD_ID, BUILD_ID_FALLBACK } from '@/lib/build-id';
import { otpDigest, OTP_LIMITS } from '@/lib/auth/otp';

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
    const isCloudflare = Boolean(env) || Boolean((globalThis as any).Cloudflare);
    const isProd = isCloudflare ? true : process.env.NODE_ENV === 'production';
    if (isProd && !(env?.OTP_HMAC_SECRET || process.env.OTP_HMAC_SECRET)) {
      return NextResponse.json({ error: 'Authentication unavailable' }, { status: 500 });
    }
    const buildId = BUILD_ID || BUILD_ID_FALLBACK;
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
    if (env && !d1 && isProd) {
      console.error('D1 binding DB is undefined', {
        hasEnv: !!env,
        keys: env ? Object.keys(env) : [],
      });
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const resendKeyValue = typeof emailEnv.RESEND_API_KEY === 'string' ? emailEnv.RESEND_API_KEY.trim() : '';
    const resendFromValue = typeof emailEnv.RESEND_FROM === 'string' ? emailEnv.RESEND_FROM.trim() : '';
    const hasResendKey = resendKeyValue.length > 0;
    const hasResendFrom = resendFromValue.length > 0;

    if (isCloudflare) {
      console.log(
        `request-otp buildId=${buildId} hasResendKey=${hasResendKey} hasResendFrom=${hasResendFrom}`
      );
    }

    if (isProd && (!hasResendKey || !hasResendFrom)) {
      return NextResponse.json(
        {
          error: 'Email service not configured',
          buildId,
          hasResendKey,
          hasResendFrom,
        },
        { status: 500 }
      );
    }

    const { email } = await request.json();
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const rawEmail = email.trim();
    const normalizedEmail = normalizeEmail(rawEmail);
    const ip = isProd
      ? (request.headers.get('cf-connecting-ip') || '').trim()
      : (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'development').split(',')[0].trim();
    if (!ip) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 500 });
    const rate = async (key: string, limit: number) => {
      if (d1) {
        const now = Date.now();
        const windowStart = Math.floor(now / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const { limiterDigest } = await import('@/lib/auth/otp');
        const hash = limiterDigest(key, isProd, env?.OTP_HMAC_SECRET);
        await d1.prepare('DELETE FROM otp_rate_limits WHERE expires_at <= ?').bind(now).run();
        const row: any = await d1.prepare(`INSERT INTO otp_rate_limits (key_hash, window_start, expires_at, count) VALUES (?, ?, ?, 1)
          ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`)
          .bind(hash, windowStart, windowStart + 15 * 60 * 1000, limit).first();
        return row ? 0 : Math.max(1, Math.ceil((windowStart + 15 * 60 * 1000 - now) / 1000));
      }
      const { dbService } = await import('@/lib/db/service');
      const result = await dbService.consumeRateLimit(key, key.startsWith('email:') ? OTP_LIMITS.requestEmail : OTP_LIMITS.requestIp);
      return result.allowed ? 0 : result.retryAfter;
    };
    const emailRetry = await rate(`email:${normalizedEmail}`, OTP_LIMITS.requestEmail);
    const ipRetry = await rate(`ip:${ip}`, OTP_LIMITS.requestIp);
    if (emailRetry || ipRetry) {
      const retry = Math.max(emailRetry, ipRetry);
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retry) } });
    }

    const code = randomInt(100000, 999999).toString();
    const codeHash = otpDigest(normalizedEmail, code, isProd, env?.OTP_HMAC_SECRET);
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = nowSec + 10 * 60;

    if (d1) {
    const updateResult = await d1
      .prepare(
        'UPDATE otp_challenges '
          + 'SET otp_hash = ?, expires_at = ?, consumed_at = NULL, attempts = 0, created_at = ? '
          + 'WHERE email = ?'
      )
      .bind(codeHash, expiresAtSec, nowSec, normalizedEmail)
      .run();

    if (!updateResult?.meta?.changes) {
      await d1
        .prepare(
          'INSERT INTO otp_challenges (email, otp_hash, attempts, expires_at, created_at, consumed_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(normalizedEmail, codeHash, 0, expiresAtSec, nowSec, null)
        .run();
    }
    } else if (!isCloudflare) {
      const { dbService } = await import('@/lib/db/service');
      await dbService.createOTP(normalizedEmail, codeHash);
    } else {
      return NextResponse.json({ error: 'DB not configured', buildId }, { status: 500 });
    }
    
    const emailResult = await sendOTPEmail(rawEmail, code, emailEnv, isProd);

    if (!emailResult.success) {
      const status = emailResult?.error?.status ?? undefined;
      console.error(
        `request-otp resend failed buildId=${buildId} status=${status ?? 'unknown'}`
      );
      return NextResponse.json(
        {
          error: 'Email send failed',
           buildId,
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, buildId });
    
  } catch (error) {
    console.error('Request OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
