export type AiOperation = 'chat' | 'generate';
export type AiUsageStatus = 'succeeded' | 'failed';

interface UsageDb {
  prepare: (sql: string) => {
    get: (...params: unknown[]) => Promise<unknown>;
    run: (...params: unknown[]) => Promise<unknown>;
  };
}

interface UsageCeilings {
  hourly: number;
  daily: number;
  concurrent: number;
}

export const AI_USAGE_LEASE_MS = 2 * 60 * 1_000;
export const AI_GENERATION_MAX_TOKENS = 600;

export function aiUsageCeilings(
  operation: AiOperation,
  plan: string
): UsageCeilings {
  if (operation === 'generate') {
    return plan === 'free'
      ? { hourly: 2, daily: 2, concurrent: 1 }
      : { hourly: 6, daily: 24, concurrent: 1 };
  }
  return plan === 'free'
    ? { hourly: 10, daily: 50, concurrent: 2 }
    : { hourly: 60, daily: 300, concurrent: 4 };
}

export async function reserveAiUsage(input: {
  db: UsageDb;
  reservationId: string;
  userId: string;
  operation: AiOperation;
  plan: string;
  now?: number;
}): Promise<boolean> {
  const now = input.now ?? Date.now();
  const hourStart = now - 60 * 60 * 1_000;
  const dayStart = now - 24 * 60 * 60 * 1_000;
  const leaseExpiresAt = now + AI_USAGE_LEASE_MS;
  const ceilings = aiUsageCeilings(input.operation, input.plan);

  const row = await input.db
    .prepare(
      `INSERT INTO ai_usage_ledger
         (id, user_id, operation, status, created_at, lease_expires_at)
       SELECT ?, ?, ?, 'reserved', ?, ?
       WHERE
         (SELECT COUNT(*) FROM ai_usage_ledger
          WHERE user_id = ? AND operation = ? AND created_at >= ?) < ?
       AND
         (SELECT COUNT(*) FROM ai_usage_ledger
          WHERE user_id = ? AND operation = ? AND created_at >= ?) < ?
       AND
         (SELECT COUNT(*) FROM ai_usage_ledger
          WHERE user_id = ? AND operation = ? AND status = 'reserved'
            AND lease_expires_at > ?) < ?
       RETURNING id`
    )
    .get(
      input.reservationId,
      input.userId,
      input.operation,
      now,
      leaseExpiresAt,
      input.userId,
      input.operation,
      hourStart,
      ceilings.hourly,
      input.userId,
      input.operation,
      dayStart,
      ceilings.daily,
      input.userId,
      input.operation,
      now,
      ceilings.concurrent
    );
  return Boolean(row);
}

export async function finalizeAiUsage(input: {
  db: UsageDb;
  reservationId: string;
  status: AiUsageStatus;
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  const row = await input.db
    .prepare(
      `UPDATE ai_usage_ledger
       SET status = ?, finalized_at = ?, lease_expires_at = ?
       WHERE id = ? AND status = 'reserved'
       RETURNING id`
    )
    .get(
      input.status,
      now,
      now,
      input.reservationId
    );
  if (!row) throw new Error('AI usage reservation could not be finalized');
}

export type GenerationGateResult<T> =
  | { kind: 'duplicate'; value: T }
  | { kind: 'entitlement_exhausted' }
  | { kind: 'quota_exhausted' }
  | { kind: 'storage_unavailable' }
  | { kind: 'completed'; value: T }
  | { kind: 'provider_failed' };

export async function runGenerationProvider<T>(input: {
  duplicate?: T;
  entitled: boolean;
  reserve: () => Promise<boolean>;
  finalize: (status: AiUsageStatus) => Promise<void>;
  provider: () => Promise<T>;
}): Promise<GenerationGateResult<T>> {
  if (input.duplicate !== undefined) {
    return { kind: 'duplicate', value: input.duplicate };
  }
  if (!input.entitled) return { kind: 'entitlement_exhausted' };

  let reserved: boolean;
  try {
    reserved = await input.reserve();
  } catch {
    return { kind: 'storage_unavailable' };
  }
  if (!reserved) return { kind: 'quota_exhausted' };

  try {
    const value = await input.provider();
    try {
      await input.finalize('succeeded');
    } catch {
      return { kind: 'storage_unavailable' };
    }
    return { kind: 'completed', value };
  } catch {
    try {
      await input.finalize('failed');
    } catch {
      return { kind: 'storage_unavailable' };
    }
    return { kind: 'provider_failed' };
  }
}