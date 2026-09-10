export interface AnnualPrice {
  priceMonthly: number;
  priceYearly: number;
}

export function calculateAnnualSavingsPercent(
  monthlyPrice: number,
  annualPrice: number,
): number {
  if (!Number.isFinite(monthlyPrice) || !Number.isFinite(annualPrice) || monthlyPrice <= 0) {
    return 0;
  }

  const fullYearPrice = monthlyPrice * 12;
  const savingsPercent = ((fullYearPrice - annualPrice) / fullYearPrice) * 100;

  return Math.max(0, Math.round(savingsPercent));
}

export function calculateMinimumAnnualSavingsPercent(plans: readonly AnnualPrice[]): number {
  if (plans.length === 0) return 0;

  return Math.min(
    ...plans.map((plan) =>
      calculateAnnualSavingsPercent(plan.priceMonthly, plan.priceYearly),
    ),
  );
}