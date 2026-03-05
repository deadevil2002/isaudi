import { dbService } from '@/lib/db/service';
import { getPlan, getPlanLimits, PlanId, PlanLimits } from './plans';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'trialing'
  | 'none';

export interface SubscriptionState {
  planId: PlanId;
  status: SubscriptionStatus;
  startedAt: number | null;
  expiresAt: number | null;
  isActiveNow: boolean;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
}

export async function getActiveSubscriptionByUserId(userId: string): Promise<any | null> {
  if (!userId) return null;
  const sub = await dbService.getSubscriptionByUserId(userId);
  return sub || null;
}

export function computeSubscriptionState(subRow: any): SubscriptionState {
  const now = Date.now();
  const planId = (subRow?.planId || 'free') as PlanId;
  const status = (subRow?.status || 'none') as SubscriptionStatus;

  const expiresAt = subRow?.expiresAt || null;
  const isActiveNow = status === 'active' && !!expiresAt && expiresAt > now;

  return {
    planId,
    status,
    startedAt: subRow?.startedAt || null,
    expiresAt,
    isActiveNow,
    cancelAtPeriodEnd: subRow?.cancelAtPeriodEnd === 1,
    limits: getPlanLimits(planId),
  };
}

export async function getUserEntitlements(userId: string): Promise<{ ok: boolean; planId: PlanId; status: SubscriptionStatus; startedAt: number | null; expiresAt: number | null; isActiveNow: boolean; cancelAtPeriodEnd: boolean; limits: PlanLimits; }> {
  const subRow = await getActiveSubscriptionByUserId(userId);
  const state = computeSubscriptionState(subRow);
  return {
    ok: true,
    ...state,
  };
}