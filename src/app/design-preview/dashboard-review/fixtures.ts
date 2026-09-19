export const fixtureReportData = {
  metrics: {
    totalSales: 15000,
    totalOrders: 120,
    avgOrderValue: 125,
    excludedOrdersCount: 2,
    excludedSales: 300
  },
  summary: "This is a deterministic fallback summary.",
  aiNarrative: {
    executiveSummary: "Your store is performing well with a 15% increase in sales compared to last week. The top products are driving most of the revenue, but there are clear opportunities to optimize margins.",
    conversionInsights: [
      "Customers are dropping off at the payment step. Streamlining this could boost checkout completion.",
      "Adding Apple Pay could improve mobile conversion by 10%."
    ],
    pricingSuggestions: [
      "Consider increasing the price of 'Smart Watch' by 5%, as it has high demand and low price sensitivity.",
      "Offer a bundle for 'Headphones' and 'Case' to boost Average Order Value."
    ],
    growthOpportunities: [
      "Run a retargeting campaign for abandoned carts.",
      "Focus on SEO for 'wireless chargers'."
    ]
  },
  top_products: [
    { name: "Smart Watch Pro", sku: "SW-01", revenue: 5000, qty: 40 },
    { name: "Wireless Earbuds", sku: "WE-02", revenue: 3000, qty: 50 }
  ],
  weak_products: [
    { name: "Old Phone Case", sku: "OPC-01", revenue: 100, qty: 5 },
    { name: "Screen Protector", sku: "SP-03", revenue: 50, qty: 2 }
  ],
  profitability: {
    totalProfit: 6000,
    marginPct: 40,
    missingCostProductsCount: 1,
    missingCostSales: 1000,
    topProfitProducts: [
      { name: "Smart Watch Pro", sku: "SW-01", totalProfit: 2500, marginPct: 50 },
      { name: "Wireless Earbuds", sku: "WE-02", totalProfit: 1500, marginPct: 50 }
    ],
    lowMarginProducts: [
      { name: "Basic Charger", sku: "BC-01", marginPct: 5 },
      { name: "USB Cable", sku: "UC-02", marginPct: 10 }
    ]
  },
  snapshot: {
    deduped: false
  }
};

export const fixtureReport = { reportJson: JSON.stringify(fixtureReportData) };

import type { ReportComparison } from "@/lib/reports/comparison-format";

export const fixtureCompareData: ReportComparison = {
  current: {
    id: "current-1",
    timeRangeStart: 1700000000000,
    timeRangeEnd: 1700600000000,
    sales: 15000,
    profit: 6000,
    marginPct: 40,
    orders: 120
  },
  previous: {
    id: "prev-1",
    timeRangeStart: 1699400000000,
    timeRangeEnd: 1700000000000,
    sales: 12000,
    profit: 4000,
    marginPct: 33.33,
    orders: 100
  },
  status: "improved",
  deltas: {
    salesDeltaPct: 25,
    profitDeltaPct: 50,
    marginDeltaPct: 6.67,
    ordersDelta: 20
  }
};

export const fixtureTrendData = [
  {
    id: "snap-1",
    createdAt: 1700600000000,
    timeRangeStart: 1700000000000,
    timeRangeEnd: 1700600000000,
    grossSales: 15000,
    totalProfit: 6000,
    marginPct: 40,
    ordersCount: 120,
    reportId: "report-1"
  },
  {
    id: "snap-2",
    createdAt: 1700000000000,
    timeRangeStart: 1699400000000,
    timeRangeEnd: 1700000000000,
    grossSales: 12000,
    totalProfit: 4000,
    marginPct: 33.33,
    ordersCount: 100,
    reportId: "report-2"
  },
  {
    id: "snap-3",
    createdAt: 1699400000000,
    timeRangeStart: 1698800000000,
    timeRangeEnd: 1699400000000,
    grossSales: 10000,
    totalProfit: 3000,
    marginPct: 30.00,
    ordersCount: 90,
    reportId: "report-3"
  },
  {
    id: "snap-4",
    createdAt: 1698800000000,
    timeRangeStart: 1698200000000,
    timeRangeEnd: 1698800000000,
    grossSales: 11000,
    totalProfit: 3500,
    marginPct: 31.81,
    ordersCount: 95,
    reportId: "report-4"
  }
];

export const fixtureInsightsData = {
  insights: [
    "Sales increased by 25% this week, largely driven by top-performing electronics.",
    "Overall margin improved from 33.3% to 40.0% due to reduced ad spend on low-converting items."
  ],
  actionItems: [
    "Increase stock for 'Smart Watch Pro' to prevent stockouts next week.",
    "Review shipping costs for 'Basic Charger' as it's eroding profitability."
  ],
  topProfitProducts: [
    { name: "Smart Watch Pro", sku: "SW-01", profitSar: 2500, marginPct: 50 },
    { name: "Wireless Earbuds", sku: "WE-02", profitSar: 1500, marginPct: 50 }
  ],
  lowMarginProducts: [
    { name: "Basic Charger", sku: "BC-01", profitSar: 20, marginPct: 5 },
    { name: "USB Cable", sku: "UC-02", profitSar: 15, marginPct: 10 }
  ]
};

export const fixtureCostsData = [
  {
    primaryProductId: "prod-1",
    identityKey: "prod-1",
    sku: "SW-01",
    externalId: "ext-1",
    name: "Smart Watch Pro",
    latestPriceHalala: 29900,
    costs: {
      purchase_cost_halala: 10000,
      labor_cost_halala: 2000,
      shipping_cost_halala: 1500,
      packaging_cost_halala: 500,
      ads_cost_per_unit_halala: 3000,
      payment_fee_percent_bps: 250
    },
    computed: {
      totalCostHalala: 17747,
      profitHalala: 12153,
      marginPercent: 40.64
    }
  },
  {
    primaryProductId: "prod-2",
    identityKey: "prod-2",
    sku: "WE-02",
    externalId: "ext-2",
    name: "Wireless Earbuds",
    latestPriceHalala: 14900,
    costs: {
      purchase_cost_halala: 5000,
      labor_cost_halala: 1000,
      shipping_cost_halala: 1000,
      packaging_cost_halala: 500,
      ads_cost_per_unit_halala: 1000,
      payment_fee_percent_bps: 250
    },
    computed: {
      totalCostHalala: 8872,
      profitHalala: 6028,
      marginPercent: 40.45
    }
  }
];
