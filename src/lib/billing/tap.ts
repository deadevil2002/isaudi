export type BillingInterval = 'month' | 'year';

export type TapPlan = {
  checkoutPlanId: string;
  entitlementPlanId: 'starter' | 'growth' | 'business';
  interval: BillingInterval;
  amountHalala: number;
  currency: 'SAR';
};

const AMOUNTS: Record<string, Record<BillingInterval, number>> = {
  starter: { month: 19_900, year: 199_900 },
  growth: { month: 39_900, year: 399_900 },
  enterprise: { month: 89_900, year: 899_900 },
};

const ENTITLEMENTS = {
  starter: 'starter',
  growth: 'growth',
  enterprise: 'business',
} as const;

export function resolveTapPlan(planId: unknown, interval: unknown): TapPlan | null {
  if (
    typeof planId !== 'string' ||
    typeof interval !== 'string' ||
    (interval !== 'month' && interval !== 'year') ||
    !(planId in AMOUNTS)
  ) {
    return null;
  }
  const checkoutPlanId = planId as keyof typeof ENTITLEMENTS;
  return {
    checkoutPlanId,
    entitlementPlanId: ENTITLEMENTS[checkoutPlanId],
    interval,
    amountHalala: AMOUNTS[checkoutPlanId][interval],
    currency: 'SAR',
  };
}

export function amountToHalala(value: unknown): number | null {
  const amount =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function validateTapPayment(input: {
  providerId: unknown;
  providerStatus: unknown;
  providerAmount: unknown;
  providerCurrency: unknown;
  metadata: unknown;
  payment: {
    providerPaymentId: unknown;
    userId: unknown;
    planId: unknown;
    interval: unknown;
    amountHalala: unknown;
    currency: unknown;
  };
  expectedUserId?: string;
}): { ok: true; plan: TapPlan; userId: string } | { ok: false; reason: string } {
  const { payment } = input;
  const plan = resolveTapPlan(payment.planId, payment.interval);
  if (!plan) return { ok: false, reason: 'plan' };

  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};
  const metadataUserId =
    typeof metadata.userId === 'string'
      ? metadata.userId
      : typeof metadata.user_id === 'string'
        ? metadata.user_id
        : '';
  const metadataPlan = typeof metadata.plan === 'string' ? metadata.plan : '';
  const metadataInterval = typeof metadata.interval === 'string' ? metadata.interval : '';
  const userId = typeof payment.userId === 'string' ? payment.userId : '';
  const providerId = typeof input.providerId === 'string' ? input.providerId : '';
  const storedProviderId =
    typeof payment.providerPaymentId === 'string' ? payment.providerPaymentId : '';
  const status =
    typeof input.providerStatus === 'string' ? input.providerStatus.toUpperCase() : '';
  const amountHalala = amountToHalala(input.providerAmount);

  if (!providerId || providerId !== storedProviderId) return { ok: false, reason: 'payment_id' };
  if (status !== 'CAPTURED' && status !== 'SUCCESS') return { ok: false, reason: 'status' };
  if (input.providerCurrency !== plan.currency || payment.currency !== plan.currency) {
    return { ok: false, reason: 'currency' };
  }
  if (amountHalala !== plan.amountHalala || payment.amountHalala !== plan.amountHalala) {
    return { ok: false, reason: 'amount' };
  }
  if (
    metadataUserId !== userId ||
    metadataPlan !== plan.checkoutPlanId ||
    metadataInterval !== plan.interval
  ) {
    return { ok: false, reason: 'metadata' };
  }
  if (input.expectedUserId && input.expectedUserId !== userId) {
    return { ok: false, reason: 'ownership' };
  }
  return { ok: true, plan, userId };
}

function changedRows(result: unknown): number {
  if (!result || typeof result !== 'object') return 0;
  const meta = (result as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return 0;
  const changes = (meta as { changes?: unknown }).changes;
  return typeof changes === 'number' ? changes : 0;
}

export async function activateTapPaymentAtomically(input: {
  db: {
    batch: (operations: Array<{ sql: string; params?: unknown[] }>) => Promise<unknown[]>;
  };
  paymentId: string;
  providerPaymentId: string;
  userId: string;
  entitlementPlanId: string;
  interval: BillingInterval;
  now: number;
  expiresAt: number;
  token?: string;
}): Promise<'activated' | 'duplicate'> {
  const token = input.token ?? crypto.randomUUID();
  const results = await input.db.batch([
    {
      sql: `UPDATE payments SET status = 'processing', processingToken = ?, updatedAt = ?
            WHERE id = ? AND provider = 'tap' AND providerPaymentId = ? AND status = 'pending'`,
      params: [token, input.now, input.paymentId, input.providerPaymentId],
    },
    {
      sql: `INSERT INTO subscriptions
              (id, userId, planId, interval, status, startedAt, expiresAt, createdAt, updatedAt,
               tapChargeId, amount, currency)
            SELECT ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, amountHalala / 100.0, currency
            FROM payments WHERE id = ? AND processingToken = ?
            ON CONFLICT(userId) DO UPDATE SET planId = excluded.planId,
              interval = excluded.interval, status = 'active', startedAt = excluded.startedAt,
              expiresAt = excluded.expiresAt, updatedAt = excluded.updatedAt,
              tapChargeId = excluded.tapChargeId, amount = excluded.amount,
              currency = excluded.currency
            WHERE COALESCE(
              (SELECT createdAt FROM payments previous
               WHERE previous.provider = 'tap'
                 AND previous.providerPaymentId = subscriptions.tapChargeId),
              0
            ) <=
              (SELECT createdAt FROM payments current
               WHERE current.id = ? AND current.processingToken = ?)`,
      params: [
        crypto.randomUUID(),
        input.userId,
        input.entitlementPlanId,
        input.interval,
        input.now,
        input.expiresAt,
        input.now,
        input.now,
        input.providerPaymentId,
        input.paymentId,
        token,
        input.paymentId,
        token,
      ],
    },
    {
      sql: `UPDATE users SET plan = ?, planExpiresAt = ?
            WHERE id = ? AND EXISTS
              (SELECT 1 FROM payments WHERE id = ? AND processingToken = ?)
              AND EXISTS
              (SELECT 1 FROM subscriptions
               WHERE userId = ? AND tapChargeId = ?)`,
      params: [
        input.entitlementPlanId,
        input.expiresAt,
        input.userId,
        input.paymentId,
        token,
        input.userId,
        input.providerPaymentId,
      ],
    },
    {
      sql: `UPDATE payments SET status = 'captured', processedAt = ?, updatedAt = ?,
              integrityError = NULL, processingToken = NULL
            WHERE id = ? AND processingToken = ?`,
      params: [input.now, input.now, input.paymentId, token],
    },
  ]);
  return changedRows(results[0]) === 1 ? 'activated' : 'duplicate';
}