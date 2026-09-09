import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { activateTapPaymentAtomically, validateTapPayment } from '@/lib/billing/tap';
import { sendTapReceiptOnce } from '@/lib/billing/receipt';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readTextWithLimit,
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

function nestedString(value: unknown, path: string[]): string {
  let current: unknown = value;
  for (const key of path) current = record(current)?.[key];
  return typeof current === 'string'
    ? current
    : typeof current === 'number'
      ? String(current)
      : '';
}

function amountString(value: unknown, currency: string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  return currency === 'SAR' && Number.isFinite(amount) ? amount.toFixed(2) : '';
}

function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(received, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  const hashString = req.headers.get('hashstring') || '';
  if (!hashString) {
    return NextResponse.json({ ok: false, error: 'hashstring missing' }, { status: 400 });
  }

  const tapSecret =
    process.env.TAP_SECRET_KEY || process.env.TAP_SECRET || process.env.TAP_API_KEY || '';
  if (!tapSecret) {
    return NextResponse.json(
      { ok: false, error: 'Payment provider unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let raw: string;
  try {
    raw = await readTextWithLimit(req, REQUEST_BODY_LIMITS.webhook);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const body = record(payload);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const id = nestedString(body, ['id']);
  const currency = nestedString(body, ['currency']);
  const status = nestedString(body, ['status']);
  const material =
    'x_id' +
    id +
    'x_amount' +
    amountString(body.amount, currency) +
    'x_currency' +
    currency +
    'x_gateway_reference' +
    nestedString(body, ['reference', 'gateway']) +
    'x_payment_reference' +
    nestedString(body, ['reference', 'payment']) +
    'x_status' +
    status +
    'x_created' +
    nestedString(body, ['transaction', 'created']);
  const expected = createHmac('sha256', tapSecret).update(material).digest('hex');
  if (!safeEqualHex(expected, hashString)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const db = (await getDb()) as unknown as Db;
  const paymentRaw = await db
    .prepare(
      `SELECT id, userId, providerPaymentId, amountHalala, currency, planId, interval,
              status, processedAt, receiptEmailSentAt
       FROM payments WHERE provider = 'tap' AND providerPaymentId = ?`
    )
    .get(id);
  const payment = record(paymentRaw);
  if (!payment) {
    console.warn('[tap-webhook] unknown payment', { provider: 'tap' });
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const validation = validateTapPayment({
    providerId: id,
    providerStatus: status,
    providerAmount: body.amount,
    providerCurrency: currency,
    metadata: body.metadata,
    payment: {
      providerPaymentId: payment.providerPaymentId,
      userId: payment.userId,
      planId: payment.planId,
      interval: payment.interval,
      amountHalala: payment.amountHalala,
      currency: payment.currency,
    },
  });
  if (!validation.ok) {
    if (validation.reason === 'status') {
      return NextResponse.json(
        { ok: true, processed: false },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
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
    providerPaymentId: id,
    userId: validation.userId,
    entitlementPlanId: validation.plan.entitlementPlanId,
    interval: validation.plan.interval,
    now,
    expiresAt,
  });
  await sendTapReceiptOnce({
    db,
    paymentId: String(payment.id),
    providerPaymentId: id,
    userId: validation.userId,
    planName: validation.plan.entitlementPlanId,
    amountHalala: validation.plan.amountHalala,
    interval: validation.plan.interval,
    processedAt:
      claim === 'activated' ? now : Number(payment.processedAt) || now,
  });

  return NextResponse.json(
    { ok: true, ...(claim === 'duplicate' ? { duplicate: true } : {}) },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}