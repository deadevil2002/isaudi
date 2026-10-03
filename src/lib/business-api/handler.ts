import { getD1Database } from '@/lib/db/d1';
import { parseReportViewData, type ReportProduct, type ReportViewData } from '@/lib/dashboard/report-view-data';
import { getUserEntitlements } from '@/lib/subscription/service';
import { authenticateBusinessApiRequest, recordBusinessApiUsage, type AuthenticatedBusinessApiKey } from './auth';
import { BUSINESS_API_PAGE_SIZE, apiError, type BusinessApiScope } from './contracts';
import type { BusinessApiD1 } from './db';

type ResourceHandler = (input: {
  request: Request;
  db: BusinessApiD1;
  auth: AuthenticatedBusinessApiKey;
  params?: Record<string, string>;
}) => Promise<Response>;

const SAFE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

function dataResponse(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: SAFE_HEADERS });
}

function decodeCursor(value: string | null): { timeRangeEnd: number; id: string } | null {
  if (!value || value.length > 256) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || !Number.isFinite(Number(parsed[0])) || typeof parsed[1] !== 'string' || parsed[1].length > 128) return null;
    return { timeRangeEnd: Number(parsed[0]), id: parsed[1] };
  } catch {
    return null;
  }
}

function encodeCursor(timeRangeEnd: number, id: string) {
  return Buffer.from(JSON.stringify([timeRangeEnd, id]), 'utf8').toString('base64url');
}

export function createBusinessApiRoute(input: {
  scope: BusinessApiScope;
  endpoint: string;
  resource: ResourceHandler;
  getDb?: () => BusinessApiD1 | null;
  getEntitlements?: typeof getUserEntitlements;
  now?: () => number;
}) {
  return async (request: Request, context?: { params?: Promise<Record<string, string>> }) => {
    const db = (input.getDb ?? (() => getD1Database() as BusinessApiD1 | null))();
    if (!db) return apiError('service_unavailable', 'The API is temporarily unavailable.', 503);
    try {
      const clock = input.now ?? Date.now;
      const started = clock();
      const authenticated = await authenticateBusinessApiRequest({ request, db, requiredScope: input.scope, getEntitlements: input.getEntitlements, now: started });
      if ('response' in authenticated) {
        if (authenticated.auth) {
          try {
            await recordBusinessApiUsage({ db, auth: authenticated.auth, endpoint: input.endpoint, status: authenticated.response.status, latencyMs: clock() - started, now: clock() });
          } catch {
            return apiError('service_unavailable', 'Usage accounting could not be completed.', 503);
          }
        }
        return authenticated.response;
      }
      let response: Response;
      try {
        response = await input.resource({ request, db, auth: authenticated.auth, params: await context?.params });
      } catch {
        response = apiError('service_unavailable', 'The request could not be completed.', 500);
      }
      try {
        await recordBusinessApiUsage({ db, auth: authenticated.auth, endpoint: input.endpoint, status: response.status, latencyMs: clock() - started, now: clock() });
      } catch {
        return apiError('service_unavailable', 'Usage accounting could not be completed.', 503);
      }
      return response;
    } catch {
      return apiError('service_unavailable', 'The API is temporarily unavailable.', 503);
    }
  };
}

export const accountResource: ResourceHandler = async ({ request, db, auth }) => {
  if (new URL(request.url).search) return apiError('invalid_request', 'This endpoint does not accept query parameters.', 400);
  const account = await db.prepare('SELECT email FROM users WHERE id = ? LIMIT 1').bind(auth.userId).first<{ email: string }>();
  if (!account) return apiError('not_found', 'Account not found.', 404);
  return dataResponse({ email: account.email, plan: 'business', keyPrefix: auth.prefix, scopes: auth.scopes });
};

export const storesResource: ResourceHandler = async ({ request, db, auth }) => {
  if (new URL(request.url).search) return apiError('invalid_request', 'This endpoint does not accept query parameters.', 400);
  const result = await db.prepare(`SELECT merchantId, storeName, storefrontOrigin, status, updatedAt
    FROM salla_connections WHERE userId = ?
    ORDER BY updatedAt DESC LIMIT 10`).bind(auth.userId).all<Record<string, unknown>>();
  return dataResponse(result.results.map(row => ({
    id: String(row.merchantId),
    name: row.storeName ? String(row.storeName) : null,
    url: row.storefrontOrigin ? String(row.storefrontOrigin) : null,
    status: String(row.status),
    platform: 'salla',
    updatedAt: Number(row.updatedAt),
  })));
};

export const reportsResource: ResourceHandler = async ({ request, db, auth }) => {
  const url = new URL(request.url);
  for (const key of url.searchParams.keys()) {
    if (key !== 'limit' && key !== 'cursor') return apiError('invalid_request', 'Unsupported query parameter.', 400);
  }
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? BUSINESS_API_PAGE_SIZE.default : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > BUSINESS_API_PAGE_SIZE.max) {
    return apiError('invalid_request', `limit must be between 1 and ${BUSINESS_API_PAGE_SIZE.max}.`, 400);
  }
  const rawCursor = url.searchParams.get('cursor');
  const cursor = decodeCursor(rawCursor);
  if (rawCursor && !cursor) return apiError('invalid_request', 'Invalid cursor.', 400);
  const sql = `SELECT id, created_at, time_range_start, time_range_end, gross_sales_halala,
    orders_count, total_profit_halala, margin_pct_x100,
    missing_cost_products_count, missing_cost_sales_halala
    FROM report_snapshots WHERE user_id = ?${cursor ? ' AND (time_range_end < ? OR (time_range_end = ? AND id < ?))' : ''}
    ORDER BY time_range_end DESC, id DESC LIMIT ?`;
  const statement = db.prepare(sql);
  const bound = cursor
    ? statement.bind(auth.userId, cursor.timeRangeEnd, cursor.timeRangeEnd, cursor.id, limit + 1)
    : statement.bind(auth.userId, limit + 1);
  const result = await bound.all<Record<string, unknown>>();
  const hasMore = result.results.length > limit;
  const rows = result.results.slice(0, limit);
  const last = rows.at(-1);
  return dataResponse({
    items: rows.map(reportSummary),
    nextCursor: hasMore && last ? encodeCursor(Number(last.time_range_end), String(last.id)) : null,
  });
};

export const reportDetailResource: ResourceHandler = async ({ request, db, auth, params }) => {
  if (new URL(request.url).search) return apiError('invalid_request', 'This endpoint does not accept query parameters.', 400);
  const id = params?.id?.trim();
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) return apiError('invalid_request', 'Invalid report ID.', 400);
  const report = await db.prepare(`SELECT id, created_at, time_range_start, time_range_end,
    gross_sales_halala, orders_count, total_profit_halala, margin_pct_x100,
    missing_cost_products_count, missing_cost_sales_halala, report_json
    FROM report_snapshots WHERE user_id = ? AND id = ? LIMIT 1`)
    .bind(auth.userId, id).first<Record<string, unknown>>();
  if (!report) return apiError('not_found', 'Report not found.', 404);
  return dataResponse({ ...reportSummary(report), analysis: safeAnalysis(parseReportViewData(String(report.report_json ?? '{}'))) });
};

function reportSummary(row: Record<string, unknown>) {
  return {
    id: String(row.id), createdAt: Number(row.created_at),
    periodStart: Number(row.time_range_start), periodEnd: Number(row.time_range_end),
    grossSalesHalala: Number(row.gross_sales_halala), ordersCount: Number(row.orders_count),
    totalProfitHalala: Number(row.total_profit_halala), marginPctX100: Number(row.margin_pct_x100),
    missingCostProductsCount: Number(row.missing_cost_products_count),
    missingCostSalesHalala: Number(row.missing_cost_sales_halala),
  };
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function product(value: unknown): ReportProduct | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.fromEntries([
    ['name', row.name], ['sku', row.sku], ['revenue', row.revenue], ['qty', row.qty],
    ['totalProfit', row.totalProfit], ['profitSar', row.profitSar], ['marginPct', row.marginPct],
  ].filter(([, item]) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))) as ReportProduct;
}

function products(value: unknown): Array<string | ReportProduct> | undefined {
  if (!Array.isArray(value)) return undefined;
  const safeProducts: Array<string | ReportProduct> = [];
  for (const item of value) {
    if (typeof item === 'string') {
      safeProducts.push(item);
      continue;
    }
    const safeProduct = product(item);
    if (safeProduct) safeProducts.push(safeProduct);
  }
  return safeProducts;
}

function safeAnalysis(value: ReportViewData): ReportViewData {
  const analysis: ReportViewData = {};
  if (typeof value.summary === 'string') analysis.summary = value.summary;
  if (typeof value.conversion_insight === 'string') analysis.conversion_insight = value.conversion_insight;
  if (typeof value.pricing_suggestions === 'string') analysis.pricing_suggestions = value.pricing_suggestions;
  else if (strings(value.pricing_suggestions)) analysis.pricing_suggestions = strings(value.pricing_suggestions);
  const growth = strings(value.growth_opportunities);
  if (growth) analysis.growth_opportunities = growth;
  if (value.aiNarrative && typeof value.aiNarrative === 'object') {
    analysis.aiNarrative = {};
    if (typeof value.aiNarrative.executiveSummary === 'string') analysis.aiNarrative.executiveSummary = value.aiNarrative.executiveSummary;
    const conversion = strings(value.aiNarrative.conversionInsights);
    const pricing = strings(value.aiNarrative.pricingSuggestions);
    const opportunities = strings(value.aiNarrative.growthOpportunities);
    if (conversion) analysis.aiNarrative.conversionInsights = conversion;
    if (pricing) analysis.aiNarrative.pricingSuggestions = pricing;
    if (opportunities) analysis.aiNarrative.growthOpportunities = opportunities;
  }
  if (value.metrics && typeof value.metrics === 'object') {
    analysis.metrics = {};
    for (const key of ['totalSales', 'totalOrders', 'avgOrderValue', 'excludedOrdersCount', 'excludedSales'] as const) {
      const item = value.metrics[key];
      if (typeof item === 'number' && Number.isFinite(item)) analysis.metrics[key] = item;
    }
  }
  const top = products(value.top_products);
  const weak = products(value.weak_products);
  if (top) analysis.top_products = top;
  if (weak) analysis.weak_products = weak;
  if (value.profitability && typeof value.profitability === 'object') {
    analysis.profitability = {};
    for (const key of ['totalProfit', 'marginPct', 'missingCostProductsCount', 'missingCostSales'] as const) {
      const item = value.profitability[key];
      if (typeof item === 'number' && Number.isFinite(item)) analysis.profitability[key] = item;
    }
    const topProfit = products(value.profitability.topProfitProducts) as ReportProduct[] | undefined;
    const lowMargin = products(value.profitability.lowMarginProducts) as ReportProduct[] | undefined;
    if (topProfit) analysis.profitability.topProfitProducts = topProfit;
    if (lowMargin) analysis.profitability.lowMarginProducts = lowMargin;
  }
  if (typeof value.snapshot?.deduped === 'boolean') analysis.snapshot = { deduped: value.snapshot.deduped };
  return analysis;
}
