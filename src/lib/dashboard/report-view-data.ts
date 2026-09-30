export type ReportProduct = {
  name?: string;
  sku?: string;
  revenue?: number;
  qty?: number;
  totalProfit?: number;
  profitSar?: number;
  marginPct?: number;
};

export type ReportViewData = {
  aiNarrative?: {
    executiveSummary?: string;
    conversionInsights?: string[];
    pricingSuggestions?: string[];
    growthOpportunities?: string[];
  };
  summary?: string;
  conversion_insight?: string;
  pricing_suggestions?: string;
  growth_opportunities?: string[];
  metrics?: {
    totalSales?: number;
    totalOrders?: number;
    avgOrderValue?: number;
    excludedOrdersCount?: number;
    excludedSales?: number;
  };
  top_products?: Array<string | ReportProduct>;
  weak_products?: Array<string | ReportProduct>;
  profitability?: {
    totalProfit?: number;
    marginPct?: number;
    missingCostProductsCount?: number;
    missingCostSales?: number;
    topProfitProducts?: ReportProduct[];
    lowMarginProducts?: ReportProduct[];
  };
  snapshot?: { deduped?: boolean };
};

const VIEW_KEYS = [
  'aiNarrative',
  'summary',
  'conversion_insight',
  'pricing_suggestions',
  'growth_opportunities',
  'metrics',
  'top_products',
  'weak_products',
  'profitability',
  'snapshot',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function pickReportViewData(value: unknown): ReportViewData {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    VIEW_KEYS.flatMap((key) => value[key] === undefined ? [] : [[key, value[key]]])
  ) as ReportViewData;
}

export function parseReportViewData(value: string): ReportViewData {
  try {
    return pickReportViewData(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}
