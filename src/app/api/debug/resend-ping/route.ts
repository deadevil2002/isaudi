import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BUILD_ID, BUILD_ID_FALLBACK } from '@/lib/build-id';

function safeCause(cause: unknown): string | undefined {
  if (cause === null || cause === undefined) return undefined;
  if (typeof cause === 'string') return cause;
  if (typeof cause === 'number' || typeof cause === 'boolean') return String(cause);
  try {
    const json = JSON.stringify(cause);
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return undefined;
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  let env: any = null;
  try {
    const ctx = getCloudflareContext();
    env = (ctx as any)?.env ?? (ctx as any)?.context?.env ?? null;
  } catch {
    env = null;
  }

  const buildId = BUILD_ID || BUILD_ID_FALLBACK;
  const resendKeyValue = typeof env?.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const resendFromValue = typeof env?.RESEND_FROM === 'string' ? env.RESEND_FROM.trim() : '';
  const hasResendKey = resendKeyValue.length > 0;
  const hasResendFrom = resendFromValue.length > 0;

  if (!env) {
    return NextResponse.json({
      ok: false,
      buildId,
      hasResendKey,
      hasResendFrom,
      ping: {
        reached: false,
        error: {
          name: 'CloudflareEnvMissing',
          message: 'Cloudflare env not available',
        },
      },
    });
  }

  if (!hasResendKey) {
    return NextResponse.json({
      ok: false,
      buildId,
      hasResendKey,
      hasResendFrom,
      ping: {
        reached: false,
        error: {
          name: 'ResendKeyMissing',
          message: 'RESEND_API_KEY is missing',
        },
      },
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKeyValue}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromValue,
        to: resendFromValue,
        subject: 'رمز الدخول لمنصة isaudi.ai',
        html: `
          <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
            <h2>مرحبًا 👋</h2>
            <p>رمز الدخول الخاص بك هو:</p>
            <h1 style="color: #006C35; letter-spacing: 5px; font-size: 32px;">123456</h1>
            <p>هذا الرمز صالح لمدة 10 دقائق.</p>
          </div>
        `,
      }),
    });

    const text = await response.text();
    const bodyPreview = text ? text.slice(0, 200) : undefined;

    return NextResponse.json({
      ok: response.ok,
      buildId,
      hasResendKey,
      hasResendFrom,
      ping: {
        reached: true,
        status: response.status,
        statusText: response.statusText || undefined,
        bodyPreview,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      buildId,
      hasResendKey,
      hasResendFrom,
      ping: {
        reached: false,
        error: {
          name: error?.name ?? 'FetchError',
          message: typeof error?.message === 'string' ? error.message : 'Fetch failed',
          cause: safeCause(error?.cause),
        },
      },
    });
  }
}
