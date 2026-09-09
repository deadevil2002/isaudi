import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getDb } from '@/lib/db/client';
import { activateTapPaymentAtomically, validateTapPayment } from '@/lib/billing/tap';
import { sendTapReceiptOnce } from '@/lib/billing/receipt';
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
  };
  batch: (operations: Array<{ sql: string; params?: unknown[] }>) => Promise<unknown[]>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await readJsonWithLimit(req, REQUEST_BODY_LIMITS.json);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
  const tapId = typeof record(body)?.tapId === 'string' ? String(record(body)?.tapId).trim() : '';
  if (!tapId) {
    return NextResponse.json({ ok: false, error: 'tapId is required' }, { status: 400 });
  }

  const tapSecret =
    process.env.TAP_SECRET_KEY || process.env.TAP_SECRET || process.env.TAP_API_KEY || '';
  if (!tapSecret) {
    return NextResponse.json({ ok: false, error: 'Payment provider unavailable' }, { status: 500 });
  }

  const db = (await getDb()) as unknown as Db;
  const payment = record(
    await db
      .prepare(
        `SELECT id, userId, providerPaymentId, amountHalala, currency, planId, interval, status,
                processedAt
         FROM payments WHERE provider = 'tap' AND providerPaymentId = ?`
      )
      .get(tapId)
  );
  if (!payment || payment.userId !== user.id) {
    return NextResponse.json(
      { ok: false, error: 'No pending payment found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const tapRes = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(tapId)}`, {
    headers: { Authorization: `Bearer ${tapSecret}`, Accept: 'application/json' },
  });
  const payload = (await tapRes.json().catch(() => null)) as unknown;
  if (!tapRes.ok || !record(payload)) {
    console.error('[billing-verify] provider verification failed', {
      provider: 'tap',
      status: tapRes.status,
    });
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const provider = record(payload)!;
  const validation = validateTapPayment({
    providerId: provider.id,
    providerStatus: provider.status,
    providerAmount: provider.amount,
    providerCurrency: provider.currency,
    metadata: provider.metadata,
    payment: {
      providerPaymentId: payment.providerPaymentId,
      userId: payment.userId,
      planId: payment.planId,
      interval: payment.interval,
      amountHalala: payment.amountHalala,
      currency: payment.currency,
    },
    expectedUserId: user.id,
  });
  if (!validation.ok) {
    await db
      .prepare('UPDATE payments SET integrityError = ?, updatedAt = ? WHERE id = ?')
      .run(validation.reason, Date.now(), payment.id);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const now = Date.now();
  const expiresAt =
    validation.plan.interval === 'year'
      ? now + 365 * 24 * 60 * 60 * 1000
      : now + 30 * 24 * 60 * 60 * 1000;
  const claim = await activateTapPaymentAtomically({
    db,
    paymentId: String(payment.id),
    providerPaymentId: tapId,
    userId: user.id,
    entitlementPlanId: validation.plan.entitlementPlanId,
    interval: validation.plan.interval,
    now,
    expiresAt,
  });
  await sendTapReceiptOnce({
    db,
    paymentId: String(payment.id),
    providerPaymentId: tapId,
    userId: user.id,
    planName: validation.plan.entitlementPlanId,
    amountHalala: validation.plan.amountHalala,
    interval: validation.plan.interval,
    processedAt:
      claim === 'activated' ? now : Number(payment.processedAt) || now,
  });

  return NextResponse.json(
    {
      ok: true,
      plan: validation.plan.entitlementPlanId,
      ...(claim === 'duplicate' ? { duplicate: true } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}