import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentReceiptEmail } from '@/lib/email/receipt';
import { getCurrentUser } from '@/lib/auth/utils';
import { getDb } from '@/lib/db/client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

type Db = {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => Promise<unknown>;
    get: (...params: unknown[]) => Promise<unknown>;
    all: (...params: unknown[]) => Promise<unknown>;
  };
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  console.log('Billing verify called for user:', user.id);

  const bodyJson = (await req.json().catch(() => null)) as unknown;
  const tapId =
    isRecord(bodyJson) && typeof bodyJson.tapId === 'string' ? bodyJson.tapId.trim() : '';

  if (!tapId) {
    return NextResponse.json(
      { ok: false, error: 'tapId is required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const tapSecret =
    process.env.TAP_SECRET_KEY || process.env.TAP_SECRET || process.env.TAP_API_KEY || '';
  if (!tapSecret) {
    return NextResponse.json(
      { ok: false, error: 'Tap secret key not configured' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const tapRes = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(tapId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tapSecret}`,
      Accept: 'application/json',
    },
  });

  const tapPayload = (await tapRes.json().catch(() => null)) as unknown;
  if (!tapRes.ok || !isRecord(tapPayload)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const statusRaw = typeof tapPayload.status === 'string' ? tapPayload.status : '';
  const currency = typeof tapPayload.currency === 'string' ? tapPayload.currency : '';
  const normalizedStatus = statusRaw.toUpperCase();
  const okStatus = normalizedStatus === 'CAPTURED' || normalizedStatus === 'SUCCESS';

  const metadata = isRecord(tapPayload.metadata) ? tapPayload.metadata : null;
  const metaUserId =
    metadata && typeof metadata.userId === 'string'
      ? metadata.userId
      : metadata && typeof metadata.user_id === 'string'
      ? metadata.user_id
      : '';

  if (!okStatus || currency !== 'SAR' || metaUserId !== user.id) {
    return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  const db = (await getDb()) as unknown as Db;

  const rowRaw = await db
    .prepare('SELECT planId, interval, status, updatedAt, tapChargeId FROM subscriptions WHERE userId = ?')
    .get(user.id);
  const row = isRecord(rowRaw) ? rowRaw : null;

  const plan = row && typeof row.planId === 'string' ? row.planId : null;
  const interval = row && row.interval === 'year' ? 'year' : 'month';
  const storedTapChargeId = row && typeof row.tapChargeId === 'string' ? row.tapChargeId : '';
  const storedStatus = row && typeof row.status === 'string' ? row.status : '';

  if (!plan || !storedTapChargeId || storedTapChargeId !== tapId || storedStatus !== 'pending') {
    return NextResponse.json(
      { ok: false, error: 'No pending subscription found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const now = Date.now();
  const expiresAt = interval === 'year' ? now + 365 * 24 * 60 * 60 * 1000 : now + 30 * 24 * 60 * 60 * 1000;

  await db
    .prepare(
      `
      UPDATE subscriptions 
      SET status = ?, startedAt = ?, updatedAt = ?, expiresAt = ?
      WHERE userId = ?
      `
    )
    .run('active', now, now, expiresAt, user.id);

  await db.prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?').run(plan, expiresAt, user.id);

  const payment = await db.prepare('SELECT * FROM payments WHERE providerPaymentId = ?').get(tapId) as any;
  if (payment && !payment.receiptEmailSentAt) {
    const emailResult = await sendPaymentReceiptEmail({
      to: user.email,
      planName: plan || 'Unknown',
      amountSAR: payment.amountHalala / 100,
      interval,
      startDate: new Date(now),
      endDate: new Date(expiresAt),
      transactionId: tapId,
      chargeId: tapId,
    });
    if (emailResult.ok) {
      await db.prepare('UPDATE payments SET receiptEmailSentAt = ?, receiptEmailId = ? WHERE id = ?').run(Date.now(), emailResult.id, payment.id);
    }
  }

  return NextResponse.json(
    { ok: true, plan },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
