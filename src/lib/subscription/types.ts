import { PlanId, PlanLimits } from "./plans";

export interface SubscriptionEntitlements {
  ok: boolean;
  planId: PlanId;
  status: string;
  startedAt: number | null;
  expiresAt: number | null;
  isActiveNow: boolean;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
}
