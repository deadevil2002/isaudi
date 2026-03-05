export const PLAN_IDS = {
  FREE: 'free',
  STARTER: 'starter',
  GROWTH: 'growth',
  BUSINESS: 'business',
} as const;

export type PlanId = typeof PLAN_IDS[keyof typeof PLAN_IDS];

export interface PlanLimits {
  maxStores: number;
  maxReportsPerMonth: number;
  aiInsights: boolean;
  apiAccess: boolean;
}

export interface Plan {
  id: PlanId;
  limits: PlanLimits;
}

const plans: Record<PlanId, Plan> = {
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    limits: {
      maxStores: 0,
      maxReportsPerMonth: 0,
      aiInsights: false,
      apiAccess: false,
    },
  },
  [PLAN_IDS.STARTER]: {
    id: PLAN_IDS.STARTER,
    limits: {
      maxStores: 1,
      maxReportsPerMonth: 30,
      aiInsights: true,
      apiAccess: false,
    },
  },
  [PLAN_IDS.GROWTH]: {
    id: PLAN_IDS.GROWTH,
    limits: {
      maxStores: 3,
      maxReportsPerMonth: 200,
      aiInsights: true,
      apiAccess: false,
    },
  },
  [PLAN_IDS.BUSINESS]: {
    id: PLAN_IDS.BUSINESS,
    limits: {
      maxStores: 10,
      maxReportsPerMonth: 999999,
      aiInsights: true,
      apiAccess: true,
    },
  },
};

export function getPlan(planId: string | null | undefined): Plan {
  const id = (planId || PLAN_IDS.FREE) as PlanId;
  return plans[id] || plans[PLAN_IDS.FREE];
}

export function getPlanLimits(planId: string | null | undefined): PlanLimits {
  return getPlan(planId).limits;
}

export function isPlanKnown(planId: string | null | undefined): boolean {
  return !!planId && Object.values(PLAN_IDS).includes(planId as PlanId);
}

export const PLAN_ORDER: Record<PlanId, number> = {
  [PLAN_IDS.FREE]: 0,
  [PLAN_IDS.STARTER]: 1,
  [PLAN_IDS.GROWTH]: 2,
  [PLAN_IDS.BUSINESS]: 3,
};

export function comparePlans(a: PlanId, b: PlanId): number {
  return (PLAN_ORDER[a] || 0) - (PLAN_ORDER[b] || 0);
}