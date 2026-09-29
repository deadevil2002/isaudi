export type BillingUiPlanId = "starter" | "growth" | "business";
export type NormalizedBillingPlanId = "free" | BillingUiPlanId;

const aliases: Record<string, NormalizedBillingPlanId> = {
  free: "free",
  basic: "starter",
  starter: "starter",
  pro: "growth",
  growth: "growth",
  business: "business",
};

export function normalizeBillingPlanId(planId: string | null | undefined): NormalizedBillingPlanId {
  return planId ? aliases[planId] || "free" : "free";
}

export const billingPlanRank: Record<NormalizedBillingPlanId, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  business: 3,
};
