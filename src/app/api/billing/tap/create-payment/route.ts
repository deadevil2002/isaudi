import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getDb } from '@/lib/db/client';

type Interval = 'month' | 'year';
const ALLOWED_PLANS = new Set(['starter', 'growth', 'enterprise']);
const ALLOWED_INTERVALS = new Set<Interval>(['month', 'year']);
const ALLOWED_CURRENCIES = new Set(['SAR']);

type Db = {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => Promise<unknown>;
    get: (...params: unknown[]) => Promise<unknown>;
    all: (...params: unknown[]) => Promise<unknown>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getAmount(planId: string, interval: Interval): number | null {
  const prices: Record<string, { month: number; year: number }> = {
    starter: { month: 199, year: 1999 },
    growth: { month: 399, year: 3999 },
    enterprise: { month: 899, year: 8999 },
  };
  const plan = prices[planId];
  if (!plan) return null;
  return interval === 'year' ? plan.year : plan.month;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const user = await getCurrentUser();
    console.log(`[tap-create-payment] [${requestId}] User check:`, { exists: !!user, userId: user?.id });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const planId = typeof payload?.planId === 'string' ? payload.planId : '';
    const interval = (typeof payload?.interval === 'string' ? payload.interval : '') as Interval;

    if (!ALLOWED_PLANS.has(planId)) {
      return NextResponse.json({ error: 'Invalid plan', requestId }, { status: 400 });
    }
    if (!ALLOWED_INTERVALS.has(interval)) {
      return NextResponse.json({ error: 'Invalid interval', requestId }, { status: 400 });
    }

    const amount = getAmount(planId, interval);
    if (amount == null) {
      return NextResponse.json({ error: 'Invalid plan', requestId }, { status: 400 });
    }

    const currency = 'SAR';
    if (!ALLOWED_CURRENCIES.has(currency)) {
      return NextResponse.json({ error: 'Invalid currency', requestId }, { status: 400 });
    }

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'isaudi.ai';
    const origin = `${proto}://${host}`;
    const redirectUrl = new URL('/billing?status=processed', origin).toString();
    const postUrl = 'https://isaudi.ai/api/billing/tap/webhook';

    const tapSecret = process.env.TAP_SECRET_KEY || process.env.TAP_API_KEY || '';
    if (!tapSecret) {
      console.error(`[tap-create-payment] [${requestId}] Missing Tap secret key configuration`);
      return NextResponse.json(
        { error: 'Tap secret key not configured', requestId },
        { status: 500 }
      );
    }

    console.log(`[tap-create-payment] [${requestId}] Calling Tap API:`, {
      amount,
      currency,
      planId,
      interval,
    });

    const tapRes = await fetch('https://api.tap.company/v2/charges/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tapSecret}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
        customer_initiated: true,
        threeDSecure: true,
        save_card: false,
        description: `isaudi.ai subscription: ${planId} (${interval})`,
        metadata: {
          userId: user.id,
          plan: planId,
          interval,
        },
        customer: {
          email: user.email,
          first_name: 'isaudi',
          last_name: 'user',
        },
        source: {
          id: 'src_all',
        },
        post: { url: postUrl },
        redirect: { url: redirectUrl },
      }),
    });

    const tapResText = await tapRes.text();
    let tapJson: any = null;
    try {
      tapJson = JSON.parse(tapResText);
    } catch (e) {
      // JSON parse failed, use raw text
    }

    if (!tapRes.ok) {
      const tapStatus = tapRes.status;
      console.error(`[tap-create-payment] [${requestId}] Tap API error:`, {
        status: tapStatus,
        body: tapJson || tapResText,
      });
      return NextResponse.json(
        {
          error: 'Tap error',
          requestId,
          tapStatus,
          details: tapJson?.errors || tapJson || tapResText.slice(0, 500),
        },
        { status: tapStatus >= 400 && tapStatus < 600 ? tapStatus : 502 }
      );
    }

    if (!isRecord(tapJson)) {
      console.error(`[tap-create-payment] [${requestId}] Invalid Tap response body:`, tapResText);
      return NextResponse.json(
        { error: 'Invalid response from Tap', requestId },
        { status: 502 }
      );
    }

    const tapChargeId = typeof tapJson.id === 'string' ? tapJson.id : '';
    const transaction = isRecord(tapJson.transaction) ? tapJson.transaction : null;
    const redirect = isRecord(tapJson.redirect) ? tapJson.redirect : null;
    const transactionUrl =
      transaction && typeof transaction.url === 'string'
        ? transaction.url
        : redirect && typeof redirect.url === 'string'
        ? redirect.url
        : typeof tapJson.url === 'string'
        ? tapJson.url
        : '';

    if (!tapChargeId || !transactionUrl) {
      console.error(`[tap-create-payment] [${requestId}] Missing tapChargeId or transactionUrl in response:`, tapJson);
      return NextResponse.json({ error: 'Tap charge creation failed', requestId }, { status: 502 });
    }

    const db = (await getDb()) as unknown as Db;
    const now = Date.now();
    await db
      .prepare(
        `
        INSERT INTO subscriptions (id, userId, planId, interval, status, createdAt, startedAt, expiresAt, updatedAt, tapChargeId, amount, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId) DO UPDATE SET
          planId = excluded.planId,
          interval = excluded.interval,
          status = excluded.status,
          updatedAt = excluded.updatedAt,
          tapChargeId = excluded.tapChargeId,
          amount = excluded.amount,
          currency = excluded.currency
        `
      )
      .run(
        crypto.randomUUID(),
        user.id,
        planId,
        interval,
        'pending',
        now, // createdAt
        now, // startedAt
        now, // expiresAt (provisional)
        now, // updatedAt
        tapChargeId,
        amount,
        currency
      );

    return NextResponse.json(
      {
        ok: true,
        redirectUrl: transactionUrl,
        tapChargeId,
        requestId,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    console.error(`[tap-create-payment] [${requestId}]`, {
      message: error.message,
      stack: error.stack,
    });
    const isProd = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      {
        error: 'Internal server error',
        requestId,
        ...(isProd ? {} : { detail: error.message }),
      },
      { status: 500 }
    );
  }
}
