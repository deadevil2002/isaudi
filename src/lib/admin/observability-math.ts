import { aiUsageCeilings, type AiOperation } from '@/lib/ai/usage-ledger';
import { resolveTapPlan } from '@/lib/billing/tap';
import {
  getPlan,
  getPlanLimits,
  isPlanKnown,
  PLAN_IDS,
  type PlanId,
} from '@/lib/subscription/plans';

export type AiTotals = {
  requestCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  providerErrorCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  latencyTotalMs: number;
  latencySamples: number;
  latencyBuckets: number[];
};

export const emptyAiTotals = (): AiTotals => ({
  requestCount: 0,
  successCount: 0,
  failureCount: 0,
  timeoutCount: 0,
  rateLimitCount: 0,
  providerErrorCount: 0,
  status2xxCount: 0,
  status4xxCount: 0,
  status5xxCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  latencyTotalMs: 0,
  latencySamples: 0,
  latencyBuckets: [0, 0, 0, 0, 0, 0, 0],
});

export function addAiTotals(target: AiTotals, source: AiTotals): AiTotals {
  target.requestCount += source.requestCount;
  target.successCount += source.successCount;
  target.failureCount += source.failureCount;
  target.timeoutCount += source.timeoutCount;
  target.rateLimitCount += source.rateLimitCount;
  target.providerErrorCount += source.providerErrorCount;
  target.status2xxCount += source.status2xxCount;
  target.status4xxCount += source.status4xxCount;
  target.status5xxCount += source.status5xxCount;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.totalTokens += source.totalTokens;
  target.cachedInputTokens += source.cachedInputTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.latencyTotalMs += source.latencyTotalMs;
  target.latencySamples += source.latencySamples;
  source.latencyBuckets.forEach((value, index) => {
    target.latencyBuckets[index] += value;
  });
  return target;
}

export function estimateGpt4oMiniCostMicroUsd(totals: Pick<
  AiTotals,
  'inputTokens' | 'outputTokens' | 'cachedInputTokens'
>): number {
  const cached = Math.min(totals.inputTokens, totals.cachedInputTokens);
  const uncached = Math.max(0, totals.inputTokens - cached);
  // Official gpt-4o-mini text rates per 1M tokens: $0.15 input,
  // $0.075 cached input, $0.60 output. micro-USD = tokens * rate.
  return Math.round(uncached * 0.15 + cached * 0.075 + totals.outputTokens * 0.6);
}

const LATENCY_BUCKET_MAX_MS = [100, 250, 500, 1000, 2500, 5000, null] as const;

export function approximateLatencyPercentile(
  buckets: number[],
  samples: number,
  percentile: number
): number | null {
  if (samples < 5 || buckets.length !== LATENCY_BUCKET_MAX_MS.length) return null;
  const target = Math.max(1, Math.ceil(samples * percentile));
  let cumulative = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    cumulative += buckets[index] ?? 0;
    if (cumulative >= target) return LATENCY_BUCKET_MAX_MS[index];
  }
  return null;
}

export function quotaStatus(input: {
  operation: AiOperation;
  plan: string;
  hourlyUsed: number;
  dailyUsed: number;
}) {
  const ceiling = aiUsageCeilings(input.operation, input.plan);
  return {
    hourly: {
      used: input.hourlyUsed,
      limit: ceiling.hourly,
      remaining: Math.max(0, ceiling.hourly - input.hourlyUsed),
    },
    daily: {
      used: input.dailyUsed,
      limit: ceiling.daily,
      remaining: Math.max(0, ceiling.daily - input.dailyUsed),
    },
  };
}

export function reportAllowance(plan: string): number | null {
  if (!isPlanKnown(plan)) return null;
  return getPlanLimits(plan).maxReportsPerMonth;
}

export function monthlyRevenueHalala(plan: string): number {
  const checkoutPlan = plan === PLAN_IDS.BUSINESS ? 'enterprise' : plan;
  return resolveTapPlan(checkoutPlan, 'month')?.amountHalala ?? 0;
}

export function planEntitlements(planId: string) {
  if (!isPlanKnown(planId)) return null;
  const plan = getPlan(planId);
  const chat = aiUsageCeilings('chat', plan.id);
  const generate = aiUsageCeilings('generate', plan.id);
  return {
    id: plan.id as PlanId,
    maxStores: plan.limits.maxStores,
    maxReportsPerMonth: plan.limits.maxReportsPerMonth,
    aiInsights: plan.limits.aiInsights,
    dataExport: plan.limits.dataExport,
    apiAccess: plan.limits.apiAccess,
    chat: { hourly: chat.hourly, daily: chat.daily, concurrent: chat.concurrent },
    generate: {
      hourly: generate.hourly,
      daily: generate.daily,
      concurrent: generate.concurrent,
    },
  };
}

export type LimitStatus = 'available' | 'approaching' | 'reached' | 'not_entitled';

export function limitStatus(used: number, allowed: number): LimitStatus {
  if (allowed <= 0) return 'not_entitled';
  if (used >= allowed) return 'reached';
  return used / allowed >= 0.8 ? 'approaching' : 'available';
}
