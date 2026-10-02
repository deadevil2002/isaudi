import type { AiChatResponse } from './contracts';
import { AI_UNTRUSTED_DATA_POLICY } from './chat-guard';

type ProductSignal = {
  name?: string;
  sku?: string | null;
  revenue?: number;
  qty?: number;
  totalProfit?: number;
  marginPct?: number | null;
};

export type CompactAnalysisContext = {
  executive_summary: {
    currency: 'SAR';
    revenue: number;
    orders: number;
    average_order_value: number;
    profit: number | null;
    margin_percent: number | null;
  };
  problems: Array<{
    kind: string;
    evidence: string;
  }>;
  evidence: {
    top_products: ProductSignal[];
    weak_products: ProductSignal[];
    top_profit_products: ProductSignal[];
    low_margin_products: ProductSignal[];
  };
  data_availability: {
    costs: 'complete' | 'partial' | 'unavailable';
    conversion: 'unavailable';
    comparison: 'unavailable';
    refunds: 'unavailable';
  };
};

type ReportShape = {
  metrics?: {
    totalSales?: unknown;
    totalOrders?: unknown;
    avgOrderValue?: unknown;
  };
  profitability?: {
    totalProfit?: unknown;
    marginPct?: unknown;
    missingCostProductsCount?: unknown;
    missingCostSales?: unknown;
    topProfitProducts?: unknown;
    lowMarginProducts?: unknown;
  };
  top_products?: unknown;
  weak_products?: unknown;
};

export type AiQuestionComplexity = 'factual' | 'analytical' | 'deep';

const ANALYSIS_SYSTEM_INSTRUCTIONS = [
  'You are iSaudi Intelligence, a professional Saudi ecommerce analyst.',
  'Interpret and prioritize only the deterministic facts supplied by the server; never recalculate or invent financial values.',
  'Distinguish facts from inferences. Every important recommendation must cite supplied evidence.',
  'Explain what is wrong, why it matters, the evidence, business impact, the priority action, and what to do first.',
  'Avoid generic advice unless a supplied metric or product signal supports it.',
  'For analysis type, make every required field meaningful. Include at least one evidence-backed pricing statement and one growth statement; when an action is unsupported, state that the required evidence is unavailable instead of fabricating advice.',
  'When evidence is insufficient, set type to insufficient_data and name the missing evidence.',
  'Write concise, natural Saudi Arabic in plain text without Markdown syntax.',
  AI_UNTRUSTED_DATA_POLICY,
].join(' ');

const CHAT_SYSTEM_INSTRUCTIONS = [
  'You are iSaudi Intelligence, a professional Saudi ecommerce consultant.',
  'Answer only from the compact deterministic report context supplied by the server.',
  'Facts and metrics must match the supplied context exactly. Clearly label inference and uncertainty.',
  'For a diagnosis, explain the finding, evidence, business impact, and prioritized actions.',
  'Do not produce Markdown. Return only the required structured response.',
  'Use concise natural Saudi Arabic unless the user asks in English.',
  AI_UNTRUSTED_DATA_POLICY,
].join(' ');

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asProducts(value: unknown, limit = 5): ProductSignal[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const sku = typeof record.sku === 'string' ? record.sku.trim() : null;
    if (!name && !sku) return [];
    const signal: ProductSignal = { name: name || undefined, sku };
    for (const key of ['revenue', 'qty', 'totalProfit', 'marginPct'] as const) {
      const number = finiteNumber(record[key]);
      if (number !== null) signal[key] = number;
    }
    return [signal];
  });
}

export function buildCompactAnalysisContext(input: {
  metrics: {
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  profitability: {
    totalProfit: number;
    marginPct: number;
    missingCostProductsCount: number;
    missingCostSales: number;
    topProfitProducts: ProductSignal[];
    lowMarginProducts: ProductSignal[];
  };
  topProducts: ProductSignal[];
  weakProducts: ProductSignal[];
}): CompactAnalysisContext {
  const { metrics, profitability } = input;
  const costs =
    metrics.totalOrders === 0
      ? 'unavailable'
      : profitability.missingCostProductsCount > 0
        ? 'partial'
        : 'complete';
  const problems: CompactAnalysisContext['problems'] = [];

  if (profitability.missingCostProductsCount > 0) {
    problems.push({
      kind: 'missing_cost_data',
      evidence: `${profitability.missingCostProductsCount} product(s) lack cost data, affecting SAR ${profitability.missingCostSales.toFixed(2)} of sales.`,
    });
  }
  const lowestMargin = profitability.lowMarginProducts[0];
  if (lowestMargin && typeof lowestMargin.marginPct === 'number') {
    problems.push({
      kind: 'low_margin_product',
      evidence: `${lowestMargin.name || lowestMargin.sku || 'Product'} has ${lowestMargin.marginPct.toFixed(2)}% margin.`,
    });
  }
  if (input.weakProducts[0]) {
    const weak = input.weakProducts[0];
    problems.push({
      kind: 'weak_product_performance',
      evidence: `${weak.name || weak.sku || 'Product'} recorded ${weak.qty ?? 0} units and SAR ${(weak.revenue ?? 0).toFixed(2)} revenue.`,
    });
  }

  return {
    executive_summary: {
      currency: 'SAR',
      revenue: metrics.totalSales,
      orders: metrics.totalOrders,
      average_order_value: metrics.avgOrderValue,
      profit: costs === 'complete' ? profitability.totalProfit : null,
      margin_percent: costs === 'complete' ? profitability.marginPct : null,
    },
    problems: problems.slice(0, 4),
    evidence: {
      top_products: input.topProducts.slice(0, 5),
      weak_products: input.weakProducts.slice(0, 5),
      top_profit_products: profitability.topProfitProducts.slice(0, 5),
      low_margin_products: profitability.lowMarginProducts.slice(0, 5),
    },
    data_availability: {
      costs,
      conversion: 'unavailable',
      comparison: 'unavailable',
      refunds: 'unavailable',
    },
  };
}

export function buildAnalysisMessages(context: CompactAnalysisContext) {
  return [
    { role: 'system' as const, content: ANALYSIS_SYSTEM_INSTRUCTIONS },
    {
      role: 'user' as const,
      content: [
        'BEGIN_UNTRUSTED_COMPACT_STORE_CONTEXT_JSON',
        JSON.stringify(context),
        'END_UNTRUSTED_COMPACT_STORE_CONTEXT_JSON',
        'Produce the required store analysis contract.',
      ].join('\n'),
    },
  ];
}

export function compactContextFromReport(reportJson: string): CompactAnalysisContext {
  const value = JSON.parse(reportJson) as ReportShape;
  const metrics = value.metrics ?? {};
  const profitability = value.profitability ?? {};
  const totalSales = finiteNumber(metrics.totalSales) ?? 0;
  const totalOrders = finiteNumber(metrics.totalOrders) ?? 0;
  const avgOrderValue = finiteNumber(metrics.avgOrderValue) ?? 0;
  const missingCostProductsCount = finiteNumber(
    profitability.missingCostProductsCount
  ) ?? totalOrders;

  return buildCompactAnalysisContext({
    metrics: { totalSales, totalOrders, avgOrderValue },
    profitability: {
      totalProfit: finiteNumber(profitability.totalProfit) ?? 0,
      marginPct: finiteNumber(profitability.marginPct) ?? 0,
      missingCostProductsCount,
      missingCostSales: finiteNumber(profitability.missingCostSales) ?? totalSales,
      topProfitProducts: asProducts(profitability.topProfitProducts),
      lowMarginProducts: asProducts(profitability.lowMarginProducts),
    },
    topProducts: asProducts(value.top_products),
    weakProducts: asProducts(value.weak_products),
  });
}

export function classifyAiQuestion(question: string): AiQuestionComplexity {
  const normalized = question.trim().toLocaleLowerCase('ar-SA');
  const deepPatterns = [
    /ليش.*(زادت|ارتفعت).*(ربح|هامش).*(نزل|انخفض)/,
    /why.*(sales|revenue).*(profit|margin)/,
    /(تشخيص|diagnos|حلل.*بعمق|deep analysis)/,
  ];
  if (deepPatterns.some((pattern) => pattern.test(normalized))) return 'deep';

  const analyticalPatterns = [
    /(ليش|لماذا|حلل|تحليل|فرصة|أنصح|توصي|مشكلة|سبب)/,
    /(why|analy|opportun|recommend|problem|improve)/,
  ];
  if (analyticalPatterns.some((pattern) => pattern.test(normalized))) {
    return 'analytical';
  }
  return 'factual';
}

function isEnglishQuestion(question: string): boolean {
  const latin = (question.match(/[A-Za-z]/g) ?? []).length;
  const arabic = (question.match(/[\u0600-\u06ff]/g) ?? []).length;
  return latin > arabic;
}

function sar(value: number, english: boolean): string {
  return english
    ? `SAR ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : `${value.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س`;
}

export function answerDeterministicQuestion(
  question: string,
  context: CompactAnalysisContext
): AiChatResponse | null {
  const normalized = question.trim().toLocaleLowerCase('ar-SA');
  const english = isEnglishQuestion(question);
  const metric = context.executive_summary;
  let label = '';
  let value = '';

  if (/(مبيعات|إيراد|ايراد|sales|revenue)/.test(normalized)) {
    label = english ? 'Revenue' : 'المبيعات';
    value = sar(metric.revenue, english);
  } else if (/(طلبات|عدد الطلبات|orders)/.test(normalized)) {
    label = english ? 'Orders' : 'الطلبات';
    value = metric.orders.toLocaleString(english ? 'en-US' : 'ar-SA');
  } else if (/(متوسط.*طلب|aov|average order)/.test(normalized)) {
    label = english ? 'Average order value' : 'متوسط قيمة الطلب';
    value = sar(metric.average_order_value, english);
  } else if (/(ربح|profit)/.test(normalized) && metric.profit !== null) {
    label = english ? 'Profit' : 'الربح';
    value = sar(metric.profit, english);
  } else if (/(هامش|margin)/.test(normalized) && metric.margin_percent !== null) {
    label = english ? 'Margin' : 'هامش الربح';
    value = `${metric.margin_percent.toLocaleString(english ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 })}%`;
  } else if (/(أكثر.*منتج|افضل.*منتج|best.*product|top.*product)/.test(normalized)) {
    const top = context.evidence.top_products[0];
    if (!top) return null;
    label = english ? 'Top product' : 'أفضل منتج';
    value = top.name || top.sku || (english ? 'Unavailable' : 'غير متاح');
  } else {
    return null;
  }

  const summary = english ? `${label}: ${value}.` : `${label}: ${value}.`;
  return {
    type: 'answer',
    summary,
    sections: [],
    confidence: {
      level: 'high',
      reason: english
        ? 'Answered directly from the current server-calculated report.'
        : 'إجابة مباشرة من التقرير الحالي المحسوب في الخادم.',
    },
  };
}

export function buildFocusedChatContext(
  context: CompactAnalysisContext,
  complexity: Exclude<AiQuestionComplexity, 'factual'>
): Partial<CompactAnalysisContext> {
  if (complexity === 'deep') return context;
  return {
    executive_summary: context.executive_summary,
    problems: context.problems.slice(0, 3),
    evidence: {
      top_products: context.evidence.top_products.slice(0, 3),
      weak_products: context.evidence.weak_products.slice(0, 3),
      top_profit_products: context.evidence.top_profit_products.slice(0, 3),
      low_margin_products: context.evidence.low_margin_products.slice(0, 3),
    },
    data_availability: context.data_availability,
  };
}

export function buildStructuredChatMessages(input: {
  context: Partial<CompactAnalysisContext>;
  question: string;
  complexity: Exclude<AiQuestionComplexity, 'factual'>;
}) {
  return [
    { role: 'system' as const, content: CHAT_SYSTEM_INSTRUCTIONS },
    {
      role: 'user' as const,
      content: [
        `QUESTION_COMPLEXITY=${input.complexity}`,
        'BEGIN_UNTRUSTED_COMPACT_STORE_CONTEXT_JSON',
        JSON.stringify(input.context),
        'END_UNTRUSTED_COMPACT_STORE_CONTEXT_JSON',
        'BEGIN_UNTRUSTED_USER_QUESTION',
        input.question,
        'END_UNTRUSTED_USER_QUESTION',
      ].join('\n'),
    },
  ];
}
