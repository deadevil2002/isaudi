import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getDb } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/utils';
import { resolveReportForUser } from '@/lib/reports/ownership';
import { createHash, randomUUID } from 'crypto';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';
import { requestOpenAIChat } from '@/lib/ai/openai-chat';
import { getRuntimeString } from '@/lib/runtime/environment';
import {
  AI_GENERATION_MAX_TOKENS,
  finalizeAiUsage,
  reserveAiUsage,
  type AiUsageStatus,
} from '@/lib/ai/usage-ledger';

interface TotalsRow {
  cnt: number | null;
  sum: number | null;
}

interface ProductAggregateRow {
  sku: string;
  product_name: string;
  revenue: number;
  qty: number;
}

interface SoldRow {
  sku: string;
  name: string;
  qty: number;
  revenue_sar: number;
}

interface ProductRow {
  id: string;
  priceHalala: number | null;
}

interface ProductCostsRow {
  purchase_cost_halala: number | null;
  labor_cost_halala: number | null;
  shipping_cost_halala: number | null;
  packaging_cost_halala: number | null;
  ads_cost_per_unit_halala: number | null;
  payment_fee_percent_bps: number | null;
}

interface Narrative {
  summary: string;
  conversion_insight: string | string[];
  pricing_suggestions: string | string[];
  growth_opportunities: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stringList(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : fallback;
}

export async function POST(req: NextRequest) {
  let releaseAiReservation: (() => Promise<void>) | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown = {};
    try {
      body = await readJsonWithLimit(req, REQUEST_BODY_LIMITS.analysis);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
    }
    const reportId =
      body && typeof body === 'object' && 'reportId' in body
        ? (body as { reportId?: unknown }).reportId
        : null;
    const requestedReportId =
      typeof reportId === 'string' && reportId.trim() ? reportId.trim() : null;
    const targetReport = await resolveReportForUser(
      dbService,
      user.id,
      requestedReportId
    );
    if (!targetReport) {
      return requestedReportId
        ? NextResponse.json({ error: 'Report not found' }, { status: 404 })
        : NextResponse.json({ error: 'No report context. Data files missing.' }, { status: 400 });
    }
    const targetReportId = targetReport.id;

    const connection = await dbService.getStoreConnection(user.id);
    const db = await getDb();
    const prepare = db.prepare.bind(db);

    const notCountedStatuses = ['ملغي', 'محذوف'];
    const totals = await prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum 
      FROM orders 
      WHERE userId = ? AND reportId = ? AND COALESCE(status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
    `).get(user.id, targetReportId, ...notCountedStatuses) as TotalsRow;
    const excluded = await prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum 
      FROM orders 
      WHERE userId = ? AND reportId = ? AND COALESCE(status,'') IN (${notCountedStatuses.map(() => '?').join(',')})
    `).get(user.id, targetReportId, ...notCountedStatuses) as TotalsRow;
    const totalOrders = totals.cnt || 0;
    const totalSalesHalala = totals.sum || 0;
    const totalSales = (totalSalesHalala / 100);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const topRows = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as product_name,
             SUM(oi.allocated_revenue) as revenue, SUM(oi.qty) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
       WHERE oi.report_id = ? AND o.userId = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY oi.sku, oi.product_name
      ORDER BY revenue DESC
      LIMIT 5
    `).all(targetReportId, user.id, ...notCountedStatuses) as ProductAggregateRow[];

    const weakRows = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as product_name,
             SUM(oi.allocated_revenue) as revenue, SUM(oi.qty) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
       WHERE oi.report_id = ? AND o.userId = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY oi.sku, oi.product_name
      HAVING SUM(oi.qty) > 0
      ORDER BY revenue ASC, qty ASC
      LIMIT 5
    `).all(targetReportId, user.id, ...notCountedStatuses) as ProductAggregateRow[];

    const topProducts = topRows.map(r => ({ name: r.product_name || r.sku || 'غير مسمى', sku: r.sku || null, revenue: Math.round(r.revenue * 100) / 100, qty: r.qty }));
    const weakProducts = weakRows.map(r => ({ name: r.product_name || r.sku || 'غير مسمى', sku: r.sku || null, revenue: Math.round(r.revenue * 100) / 100, qty: r.qty }));

    // Build base report object
    const base = {
      metrics: {
        totalSales,
        totalOrders,
        avgOrderValue,
        excludedOrdersCount: excluded.cnt || 0,
        excludedSales: Math.round((excluded.sum || 0)) / 100
      },
      top_products: topProducts,
      weak_products: weakProducts
    };

    const sold = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as name,
             SUM(oi.qty) as qty, SUM(oi.allocated_revenue) as revenue_sar
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
       WHERE oi.report_id = ? AND o.userId = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY COALESCE(oi.sku,''), COALESCE(oi.product_name,'')
    `).all(targetReportId, user.id, ...notCountedStatuses) as SoldRow[];

    // Deduplicate before entitlement checks, quota reservation, or provider work.
    const nowMs = Date.now();
    const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
    const d = new Date(nowMs + RIYADH_OFFSET_MS);
    const day = d.getUTCDay();
    const daysSinceSaturday = (day + 1) % 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const midnightRiyadhUtcMs =
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      RIYADH_OFFSET_MS;
    const startOfWeek = midnightRiyadhUtcMs - daysSinceSaturday * dayMs;
    const endOfWeek = startOfWeek + 7 * dayMs - 1;
    const canonRows = sold
      .map((row) => ({
        sku: (row.sku || '').trim(),
        name: (row.name || '').replace(/\s+/g, ' ').trim().toLowerCase(),
        qty: row.qty || 0,
        revenueHalala: Math.round((row.revenue_sar || 0) * 100),
      }))
      .sort((left, right) =>
        `${left.sku}|${left.name}`.localeCompare(`${right.sku}|${right.name}`)
      );
    const sourceHash = createHash('sha256')
      .update(
        JSON.stringify({
          notCountedStatuses,
          window: [startOfWeek, endOfWeek],
          items: canonRows,
        })
      )
      .digest('hex');
    const existing = await dbService.getSnapshotByHash(user.id, sourceHash);
    if (existing) {
      const storedPayload: unknown = JSON.parse(existing.report_json);
      if (!isRecord(storedPayload) || typeof existing.id !== 'string') {
        throw new Error('Invalid stored snapshot');
      }
      const finalReportJson = JSON.stringify({
        ...storedPayload,
        snapshot: {
          id: existing.id,
          deduped: true,
          sourceHash,
          timeRangeStart: startOfWeek,
          timeRangeEnd: endOfWeek,
        },
      });
      await dbService.updateReportJsonForUser(
        user.id,
        targetReportId,
        finalReportJson
      );
      const updated = await dbService.getReportForUser(user.id, targetReportId);
      return updated
        ? NextResponse.json(updated)
        : NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (user.plan === 'free' && (user.freeReportsUsed || 0) >= 2) {
      return NextResponse.json(
        { error: 'Free limit reached. Upgrade to continue.' },
        { status: 403 }
      );
    }

    const openaiApiKey = getRuntimeString('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[analysis/generate] OpenAI configuration missing');
      return NextResponse.json(
        { error: 'الخدمة الذكية غير متاحة مؤقتاً.' },
        { status: 503 }
      );
    }

    let narrative: Narrative = {
      summary: '',
      conversion_insight: '',
      pricing_suggestions: '',
      growth_opportunities: []
    };

    const reservationId = randomUUID();
    let reserved: boolean;
    try {
      reserved = await reserveAiUsage({
        db,
        reservationId,
        userId: user.id,
        operation: 'generate',
        plan: user.plan,
        now: nowMs,
      });
    } catch {
      console.error('[analysis/generate] AI quota storage unavailable');
      return NextResponse.json(
        { error: 'الخدمة غير متاحة مؤقتاً.' },
        { status: 503 }
      );
    }
    if (!reserved) {
      return NextResponse.json(
        { error: 'تم بلوغ حد إنشاء التحليلات مؤقتاً. يرجى المحاولة لاحقاً.' },
        { status: 429 }
      );
    }
    releaseAiReservation = () =>
      finalizeAiUsage({ db, reservationId, status: 'failed' });
    let aiUsageFinalStatus: AiUsageStatus = 'succeeded';

    try {
      const content = await requestOpenAIChat({
          apiKey: openaiApiKey,
          messages: [
            { role: 'system', content: 'محلل تجارة إلكترونية سعودي محترف. التزم بالبيانات المرفقة. أعد JSON صالح فقط.' },
            { role: 'user', content: JSON.stringify({
                context: {
                  platform: connection?.platform || 'csv',
                  storeName: connection?.storeName || 'N/A'
                },
                metrics: base.metrics,
                top_products: base.top_products,
                weak_products: base.weak_products
              })
            }
          ],
          responseFormat: { type: 'json_object' },
          maxTokens: AI_GENERATION_MAX_TOKENS,
      });
      const parsed: unknown = JSON.parse(content);
      if (!isRecord(parsed)) {
        throw new Error('Invalid narrative response');
      }
      narrative = {
        summary: stringValue(parsed.summary, narrative.summary),
        conversion_insight:
          typeof parsed.conversion_insight === 'string'
            ? parsed.conversion_insight
            : stringList(parsed.conversion_insight),
        pricing_suggestions:
          typeof parsed.pricing_suggestions === 'string'
            ? parsed.pricing_suggestions
            : stringList(parsed.pricing_suggestions),
        growth_opportunities: stringList(parsed.growth_opportunities)
      };
    } catch {
      console.error('[analysis/generate] OpenAI narrative generation failed');
      aiUsageFinalStatus = 'failed';
      narrative = {
        summary: 'تعذر توليد السرد الذكي حالياً.',
        conversion_insight: '',
        pricing_suggestions: '',
        growth_opportunities: []
      };
    }

    // Build stable aiNarrative object
    const toArray = (v: unknown): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) {
        return v.filter(
          (item): item is string => typeof item === 'string' && Boolean(item)
        );
      }
      if (typeof v === 'string') return [v].filter(Boolean);
      return [];
    };
    const aiNarrative = {
      executiveSummary: narrative.summary || 'تم إنشاء تحليل مبني على بياناتك.',
      pricingSuggestions: toArray(narrative.pricing_suggestions).length ? toArray(narrative.pricing_suggestions) : [
        'راجع تسعير المنتجات الضعيفة بتجربة عروض رزم أو خصومات محدودة المدة.'
      ],
      growthOpportunities: toArray(narrative.growth_opportunities).length ? toArray(narrative.growth_opportunities) : [
        'ركز حملات الإعلانات على أفضل المنتجات أداءً لزيادة العائد.',
        'حسّن صور ووصف المنتجات ذات الأداء الضعيف لتحسين نسبة الإضافة للسلة.'
      ],
      conversionInsights: toArray(narrative.conversion_insight).length ? toArray(narrative.conversion_insight) : [
        'نسبة التحويل تحتاج بيانات زيارات (GA4) لمقارنتها. طبّق تحسينات تجربة المستخدم: تبسيط خطوات الدفع، وإبراز حدود الشحن وسياسة الاسترجاع.'
      ]
    };

    const normalizeTitle = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const findProductBySku = async (sku: string): Promise<ProductRow | null> => {
      if (!sku) return null;
      const row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ?
        ORDER BY (CASE WHEN COALESCE(reportId,'') = ? THEN 1 ELSE 0 END) DESC, COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, sku.trim(), targetReportId) as ProductRow | null;
      return row || null;
    };
    const findProductByTitle = async (title: string): Promise<ProductRow | null> => {
      const t = normalizeTitle(title);
      if (!t) return null;
      let row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(title,'')) = ?
        AND COALESCE(reportId,'') = ?
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, t, targetReportId) as ProductRow | null;
      if (row) return row;
      row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(title,'')) = ?
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, t) as ProductRow | null;
      return row || null;
    };
    const getCosts = async (productId: string): Promise<ProductCostsRow | null> => {
      const c = await prepare(`SELECT * FROM product_costs WHERE product_id = ?`).get(productId) as ProductCostsRow | null;
      return c || null;
    };

    const profitRows: Array<{
      name: string;
      sku: string | null;
      qty: number;
      sellPriceHalala: number;
      totalProfitHalala: number;
      marginPct: number | null;
    }> = [];
    let reportTotalProfitHalala = 0;
    let missingCostProductsCount = 0;
    let missingCostSalesHalala = 0;

    for (const r of sold) {
      const qty = r.qty || 0;
      if (qty <= 0) continue;
      const sku = (r.sku || '').trim() || null;
      const title = normalizeTitle(r.name || '');
      let prod: ProductRow | null = null;
      if (sku) prod = await findProductBySku(sku);
      if (!prod && title) prod = await findProductByTitle(title);
      if (!prod) {
        const revenueHal = Math.round((r.revenue_sar || 0) * 100) || 0;
        missingCostProductsCount++;
        missingCostSalesHalala += revenueHal;
        continue;
      }
      const sellPriceHalala = (() => {
        const revHal = Math.round((r.revenue_sar || 0) * 100) || 0;
        if (qty > 0 && revHal > 0) return Math.round(revHal / qty);
        return prod.priceHalala || 0;
      })();
      const costs = await getCosts(prod.id);
      if (!costs) {
        const revenueHal = Math.round((r.revenue_sar || 0) * 100) || 0;
        missingCostProductsCount++;
        missingCostSalesHalala += revenueHal;
        continue;
      }
      const fixed = (costs.purchase_cost_halala || 0)
        + (costs.labor_cost_halala || 0)
        + (costs.shipping_cost_halala || 0)
        + (costs.packaging_cost_halala || 0)
        + (costs.ads_cost_per_unit_halala || 0);
      const fee = Math.round((sellPriceHalala * (costs.payment_fee_percent_bps || 0)) / 10000);
      const totalCostPerUnit = fixed + fee;
      const profitPerUnit = sellPriceHalala - totalCostPerUnit;
      const totalProfit = profitPerUnit * qty;
      const denom = sellPriceHalala * qty;
      const marginPct = denom > 0 ? Math.round((totalProfit / denom) * 10000) / 100 : null;
      profitRows.push({
        name: title || (sku || 'منتج'),
        sku,
        qty,
        sellPriceHalala,
        totalProfitHalala: totalProfit,
        marginPct
      });
      reportTotalProfitHalala += totalProfit;
    }

    const topProfitProducts = profitRows
      .slice()
      .sort((a, b) => (b.totalProfitHalala - a.totalProfitHalala))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        sku: p.sku,
        qty: p.qty,
        totalProfit: Math.round(p.totalProfitHalala) / 100,
        marginPct: p.marginPct
      }));
    const lowMarginProducts = profitRows
      .filter(p => p.marginPct != null)
      .slice()
      .sort((a, b) => ((a.marginPct as number) - (b.marginPct as number)))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        sku: p.sku,
        qty: p.qty,
        totalProfit: Math.round(p.totalProfitHalala) / 100,
        marginPct: p.marginPct
      }));
    const reportGrossSalesHalala = Math.round(totalSales * 100);
    const reportMarginPct = reportGrossSalesHalala > 0 ? Math.round((reportTotalProfitHalala / reportGrossSalesHalala) * 10000) / 100 : 0;
    const profitability = {
      totalProfit: Math.round(reportTotalProfitHalala) / 100,
      marginPct: reportMarginPct,
      missingCostProductsCount,
      missingCostSales: Math.round(missingCostSalesHalala) / 100,
      topProfitProducts,
      lowMarginProducts
    };

    const reportPayload = JSON.stringify({
      ...base,
      ...narrative,
      aiNarrative,
      profitability
    });

    const snapshotId = randomUUID();
    await dbService.insertSnapshot({
      id: snapshotId,
      user_id: user.id,
      created_at: nowMs,
      source_hash: sourceHash,
      time_range_start: startOfWeek,
      time_range_end: endOfWeek,
      report_id: targetReportId,
      gross_sales_halala: reportGrossSalesHalala,
      orders_count: totalOrders,
      total_profit_halala: reportTotalProfitHalala,
      margin_pct_x100: Math.round(reportMarginPct * 100),
      missing_cost_products_count: missingCostProductsCount,
      missing_cost_sales_halala: Math.round(missingCostSalesHalala),
      report_json: reportPayload
    });
    const finalReportJson = JSON.stringify({
      ...JSON.parse(reportPayload),
      snapshot: {
        id: snapshotId,
        deduped: false,
        sourceHash,
        timeRangeStart: startOfWeek,
        timeRangeEnd: endOfWeek
      }
    });
    await dbService.updateReportJsonForUser(user.id, targetReportId, finalReportJson);
    await dbService.incrementFreeReports(user.id);
    if (releaseAiReservation) {
      await finalizeAiUsage({
        db,
        reservationId,
        status: aiUsageFinalStatus,
      });
      releaseAiReservation = null;
    }
    const updated = await dbService.getReportForUser(user.id, targetReportId);
    if (!updated) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    return NextResponse.json(updated);

  } catch {
    if (releaseAiReservation) {
      try {
        await releaseAiReservation();
      } catch {
        console.error('[analysis/generate] Failed to release AI reservation');
      }
    }
    console.error('[analysis/generate] Request failed');
    return NextResponse.json(
      { error: 'الخدمة غير متاحة مؤقتاً.' },
      { status: 503 }
    );
  }
}
