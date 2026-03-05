import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentReceiptEmail } from '@/lib/email/receipt';
import { createHmac } from 'crypto';
import { getDb } from '@/lib/db/client';

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

function getNestedString(obj: unknown, path: string[]): string {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return '';
    cur = cur[key];
  }
  return typeof cur === 'string' ? cur : typeof cur === 'number' ? String(cur) : '';
}

function getAmountRoundedString(amountValue: unknown, currency: string): string {
  if (currency === 'SAR') {
    const n =
      typeof amountValue === 'number'
        ? amountValue
        : typeof amountValue === 'string'
        ? parseFloat(amountValue)
        : NaN;
    if (!isFinite(n)) return '0.00';
    return (Math.round(n * 100) / 100).toFixed(2);
  }
  if (typeof amountValue === 'string') return amountValue;
  if (typeof amountValue === 'number') return String(amountValue);
  return '';
}

function normalizeSubscriptionFailureStatus(statusRaw: string): string {
  const s = (statusRaw || '').toUpperCase();
  if (s.includes('CANCEL') || s === 'VOID' || s === 'ABANDONED') return 'cancelled';
  return 'failed';
}

export async function POST(req: NextRequest) {
  const hashStringHeader = req.headers.get('hashstring');
  if (!hashStringHeader) {
    return NextResponse.json({ ok: false, error: 'hashstring missing' }, { status: 400 });
  }

  const tapSecret =
    process.env.TAP_SECRET_KEY || process.env.TAP_SECRET || process.env.TAP_API_KEY || '';
  if (!tapSecret) {
    return NextResponse.json(
      { ok: false, error: 'Tap secret key not configured' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const raw = await req.text();
  const bodyJson = ((): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  if (!isRecord(bodyJson)) {
    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  const id = getNestedString(bodyJson, ['id']);
  const currency = getNestedString(bodyJson, ['currency']);
  const amountRounded = getAmountRoundedString(isRecord(bodyJson) ? bodyJson.amount : undefined, currency);
  const gateway_reference = getNestedString(bodyJson, ['reference', 'gateway']);
  const payment_reference = getNestedString(bodyJson, ['reference', 'payment']);
  const status = getNestedString(bodyJson, ['status']);
  const created = getNestedString(bodyJson, ['transaction', 'created']);

  const toBeHashedString =
    'x_id' +
    id +
    'x_amount' +
    amountRounded +
    'x_currency' +
    currency +
    'x_gateway_reference' +
    (gateway_reference || '') +
    'x_payment_reference' +
    (payment_reference || '') +
    'x_status' +
    status +
    'x_created' +
    (created || '');

  const computed = createHmac('sha256', tapSecret).update(toBeHashedString).digest('hex').toLowerCase();
  if (computed !== hashStringHeader.toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!id) {
    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  const db = (await getDb()) as unknown as Db;

  const rowRaw = await db.prepare('SELECT userId, planId, interval, status FROM subscriptions WHERE tapChargeId = ?').get(id);
  const row = isRecord(rowRaw) ? rowRaw : null;
  if (!row || typeof row.userId !== 'string') {
    console.log('[tap-webhook] unknown tapChargeId', { id, status, currency });
    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  const userId = row.userId;
  const plan = typeof row.planId === 'string' ? row.planId : null;
  const interval = row.interval === 'year' ? 'year' : 'month';
  const existingStatus = typeof row.status === 'string' ? row.status : '';

  const normalizedStatus = (status || '').toUpperCase();
  const isSuccess = (normalizedStatus === 'CAPTURED' || normalizedStatus === 'SUCCESS') && currency === 'SAR';

  const now = Date.now();
  if (isSuccess) {
    const expiresAt =
      interval === 'year' ? now + 365 * 24 * 60 * 60 * 1000 : now + 30 * 24 * 60 * 60 * 1000;
    if (existingStatus !== 'active') {
      await db
        .prepare('UPDATE subscriptions SET status = ?, startedAt = ?, updatedAt = ?, expiresAt = ? WHERE userId = ?')
        .run('active', now, now, expiresAt, userId);
    } else {
      await db.prepare('UPDATE subscriptions SET updatedAt = ? WHERE userId = ?').run(now, userId);
    }

    if (plan) {
      await db.prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?').run(plan, expiresAt, userId);
    }

    const payment = await db.prepare('SELECT * FROM payments WHERE providerPaymentId = ?').get(id) as any;
    if (payment && !payment.receiptEmailSentAt) {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (user) {
        const emailResult = await sendPaymentReceiptEmail({
          to: user.email,
          planName: plan || 'Unknown',
          amountSAR: payment.amountHalala / 100,
          interval,
          startDate: new Date(now),
          endDate: new Date(expiresAt),
          transactionId: id,
          chargeId: id,
        });
        if (emailResult.ok) {
          await db.prepare('UPDATE payments SET receiptEmailSentAt = ?, receiptEmailId = ? WHERE id = ?').run(Date.now(), emailResult.id, payment.id);
        }
      }
    }
  } else {
    const failedStatus = normalizeSubscriptionFailureStatus(normalizedStatus);
    if (existingStatus !== failedStatus) {
      await db.prepare('UPDATE subscriptions SET status = ?, updatedAt = ? WHERE userId = ?').run(failedStatus, now, userId);
    } else {
      await db.prepare('UPDATE subscriptions SET updatedAt = ? WHERE userId = ?').run(now, userId);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
