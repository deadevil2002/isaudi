import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getDb } from '@/lib/db/client';
import { resolveTapPlan } from '@/lib/billing/tap';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';

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

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await readJsonWithLimit(req, REQUEST_BODY_LIMITS.json);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const record = isRecord(payload) ? payload : {};
    const plan = resolveTapPlan(record.planId, record.interval);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan or interval', requestId }, { status: 400 });
    }
    const { checkoutPlanId: planId, interval, currency, amountHalala } = plan;
    const amount = amountHalala / 100;

    const redirectUrl = 'https://isaudi.ai/billing?status=processed';
    const postUrl = 'https://isaudi.ai/api/billing/tap/webhook';

    const tapSecret = process.env.TAP_SECRET_KEY || process.env.TAP_API_KEY || '';
    if (!tapSecret) {
      console.error(`[tap-create-payment] [${requestId}] Missing Tap secret key configuration`);
      return NextResponse.json(
        { error: 'Tap secret key not configured', requestId },
        { status: 500 }
      );
    }

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
    let tapJson: unknown = null;
    try {
      tapJson = JSON.parse(tapResText);
    } catch {
      // A malformed provider response is handled below without logging its body.
    }

    if (!tapRes.ok) {
      const tapStatus = tapRes.status;
      console.error(`[tap-create-payment] [${requestId}] provider request failed`, {
        provider: 'tap',
        status: tapStatus,
      });
      return NextResponse.json(
        { error: 'Payment provider request failed', requestId },
        { status: 502 }
      );
    }

    if (!isRecord(tapJson)) {
      console.error(`[tap-create-payment] [${requestId}] invalid provider response`, {
        provider: 'tap',
        status: tapRes.status,
      });
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
      console.error(`[tap-create-payment] [${requestId}] incomplete provider response`, {
        provider: 'tap',
      });
      return NextResponse.json({ error: 'Tap charge creation failed', requestId }, { status: 502 });
    }

    const db = (await getDb()) as unknown as Db;
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO payments
          (id, userId, provider, providerPaymentId, amountHalala, currency, planId, interval, status, createdAt, updatedAt, rawJson)
         VALUES (?, ?, 'tap', ?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`
      )
      .run(
        crypto.randomUUID(),
        user.id,
        tapChargeId,
        amountHalala,
        currency,
        planId,
        interval,
        now,
        now
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
  } catch {
    console.error(`[tap-create-payment] [${requestId}] internal failure`, {
      provider: 'tap',
    });
    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
