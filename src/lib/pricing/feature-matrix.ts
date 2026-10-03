import { getPlanLimits, type PlanId } from '@/lib/subscription/plans';

export type PricingFeatureId =
  | 'stores'
  | 'csv'
  | 'salla'
  | 'reports'
  | 'aiAssistant'
  | 'aiRecommendations'
  | 'dataExport'
  | 'apiAccess';

export type PricingFeature = {
  id: PricingFeatureId;
  included: boolean;
  labelKey: string;
};

export function pricingFeaturesForPlan(planId: PlanId): PricingFeature[] {
  const limits = getPlanLimits(planId);

  return [
    {
      id: 'stores',
      included: limits.maxStores > 0,
      labelKey: `pricing.matrix.stores.${planId}`,
    },
    {
      // The authenticated CSV upload route has no paid-plan discriminator.
      id: 'csv',
      included: true,
      labelKey: 'pricing.matrix.csv',
    },
    {
      // Salla claims enforce the same maxStores catalog used above.
      id: 'salla',
      included: limits.maxStores > 0,
      labelKey: 'pricing.matrix.salla',
    },
    {
      id: 'reports',
      included: limits.maxReportsPerMonth > 0,
      labelKey: `pricing.matrix.reports.${planId}`,
    },
    {
      id: 'aiAssistant',
      included: limits.aiInsights,
      labelKey: 'pricing.matrix.aiAssistant',
    },
    {
      id: 'aiRecommendations',
      included: limits.aiInsights,
      labelKey: 'pricing.matrix.aiRecommendations',
    },
    {
      id: 'dataExport',
      included: limits.dataExport,
      labelKey: 'pricing.matrix.dataExport',
    },
    {
      id: 'apiAccess',
      included: limits.apiAccess,
      labelKey: 'pricing.matrix.apiAccess',
    },
  ];
}
