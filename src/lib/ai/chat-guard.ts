export const AI_CHAT_MESSAGE_MAX_LENGTH = 2_000;
export const AI_CHAT_CONTEXT_MAX_BYTES = 24_000;
export const AI_CHAT_MAX_TOKENS = 400;
export const AI_CHAT_WINDOW_MS = 60 * 60 * 1_000;

export function aiChatLimitForPlan(plan: string): number {
  return plan === 'free' ? 10 : 60;
}

export function boundedReportContext(
  reportJson: string,
  maxBytes = AI_CHAT_CONTEXT_MAX_BYTES
): string {
  const parsed = JSON.parse(reportJson) as unknown;
  const serialized = JSON.stringify(parsed);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(serialized);
  if (bytes.byteLength <= maxBytes) return serialized;

  const suffix = '\n[تم اختصار سياق التقرير لحدود الأمان]';
  const encodedSuffix = encoder.encode(suffix);
  if (encodedSuffix.byteLength >= maxBytes) {
    return new TextDecoder().decode(encodedSuffix.slice(0, maxBytes));
  }
  const budget = maxBytes - encodedSuffix.byteLength;
  let end = budget;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  while (end > 0) {
    try {
      return `${decoder.decode(bytes.slice(0, end))}${suffix}`;
    } catch {
      // At most three trailing bytes need removal to reach a UTF-8 boundary.
      end -= 1;
    }
  }
  return suffix;
}

type QuotaDb = {
  prepare: (sql: string) => {
    get: (...params: unknown[]) => Promise<unknown>;
    run: (...params: unknown[]) => Promise<unknown>;
  };
};

export async function consumeAiChatQuota(input: {
  db: QuotaDb;
  userId: string;
  plan: string;
  now?: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = input.now ?? Date.now();
  const windowStart = Math.floor(now / AI_CHAT_WINDOW_MS) * AI_CHAT_WINDOW_MS;
  const expiresAt = windowStart + AI_CHAT_WINDOW_MS * 2;
  const limit = aiChatLimitForPlan(input.plan);

  await input.db
    .prepare('DELETE FROM ai_chat_rate_limits WHERE expires_at <= ?')
    .run(now);
  const row = (await input.db
    .prepare(
      `INSERT INTO ai_chat_rate_limits
         (user_id, window_start, expires_at, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1
         WHERE count < ?
       RETURNING count`
    )
    .get(input.userId, windowStart, expiresAt, limit)) as
    | { count?: unknown }
    | null;

  return {
    allowed: typeof row?.count === 'number' && row.count <= limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart + AI_CHAT_WINDOW_MS - now) / 1_000)
    ),
  };
}