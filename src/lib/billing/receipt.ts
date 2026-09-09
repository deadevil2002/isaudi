import { sendPaymentReceiptEmail } from '@/lib/email/receipt';
import type { BillingInterval } from '@/lib/billing/tap';

type ReceiptDb = {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => Promise<unknown>;
    get: (...params: unknown[]) => Promise<unknown>;
  };
};

function changes(result: unknown): number {
  const meta =
    result && typeof result === 'object' && 'meta' in result
      ? (result as { meta?: { changes?: unknown } }).meta
      : null;
  return typeof meta?.changes === 'number' ? meta.changes : 0;
}

export async function sendTapReceiptOnce(input: {
  db: ReceiptDb;
  paymentId: string;
  providerPaymentId: string;
  userId: string;
  planName: string;
  amountHalala: number;
  interval: BillingInterval;
  processedAt: number;
}): Promise<void> {
  const now = Date.now();
  const leaseExpiredBefore = now - 10 * 60 * 1000;
  const providerIdempotencyWindowStart = now - 24 * 60 * 60 * 1000;
  const leaseToken = crypto.randomUUID();
  const claim = await input.db
    .prepare(
      `UPDATE payments SET receiptEmailSentAt = -1, receiptClaimedAt = ?,
         receiptLeaseToken = ?
       WHERE id = ? AND receiptEmailId IS NULL
         AND COALESCE(processedAt, 0) >= ?
         AND ((receiptEmailSentAt IS NULL AND receiptLeaseToken IS NULL) OR
              (receiptEmailSentAt = -1 AND COALESCE(receiptClaimedAt, 0) < ?))`
    )
    .run(
      now,
      leaseToken,
      input.paymentId,
      providerIdempotencyWindowStart,
      leaseExpiredBefore
    );
  if (changes(claim) !== 1) return;

  const user = (await input.db
    .prepare('SELECT email FROM users WHERE id = ?')
    .get(input.userId)) as { email?: unknown } | null;
  const email = typeof user?.email === 'string' ? user.email : '';
  const endAt =
    input.processedAt +
    (input.interval === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000;
  const result = email
    ? await sendPaymentReceiptEmail({
        to: email,
        planName: input.planName,
        amountSAR: input.amountHalala / 100,
        interval: input.interval,
        startDate: new Date(input.processedAt),
        endDate: new Date(endAt),
        transactionId: input.providerPaymentId,
        chargeId: input.providerPaymentId,
        idempotencyKey: `payment-receipt:${input.paymentId}`,
      })
    : { ok: false as const };

  if (result.ok) {
    await input.db
      .prepare(
        `UPDATE payments SET receiptEmailSentAt = ?, receiptEmailId = ?,
           receiptLeaseToken = NULL
         WHERE id = ? AND receiptEmailSentAt = -1 AND receiptLeaseToken = ?`
      )
      .run(Date.now(), result.id, input.paymentId, leaseToken);
  } else {
    await input.db
      .prepare(
        `UPDATE payments SET receiptEmailSentAt = NULL, receiptClaimedAt = NULL,
           receiptLeaseToken = NULL
         WHERE id = ? AND receiptEmailSentAt = -1 AND receiptLeaseToken = ?`
      )
      .run(input.paymentId, leaseToken);
  }
}