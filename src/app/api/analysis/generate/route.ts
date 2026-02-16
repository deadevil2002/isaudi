import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getDb } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/utils';
import { createHash, randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportId } = await req.json().catch(() => ({ reportId: null as string | null }));
    const targetReportId = reportId || (await dbService.getLatestReport(user.id))?.id;
    if (!targetReportId) {
    return NextResponse.json({ error: 'No report context. Data files missing.' }, { status: 400 });
    }

    const connection = await dbService.getStoreConnection(user.id);
    const db = await getDb();
    const prepare = db.prepare.bind(db);

    const notCountedStatuses = ['ملغي', 'محذوف'];
    const totals = await prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum 
      FROM orders 
      WHERE userId = ? AND reportId = ? AND COALESCE(status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
    `).get(user.id, targetReportId, ...notCountedStatuses) as any;
    const excluded = await prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(totalHalala),0) as sum 
      FROM orders 
      WHERE userId = ? AND reportId = ? AND COALESCE(status,'') IN (${notCountedStatuses.map(() => '?').join(',')})
    `).get(user.id, targetReportId, ...notCountedStatuses) as any;
    const totalOrders = totals.cnt || 0;
    const totalSalesHalala = totals.sum || 0;
    const totalSales = (totalSalesHalala / 100);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const topRows = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as product_name,
             SUM(oi.allocated_revenue) as revenue, SUM(oi.qty) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.report_id = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY oi.sku, oi.product_name
      ORDER BY revenue DESC
      LIMIT 5
    `).all(targetReportId, ...notCountedStatuses) as any[];

    const weakRows = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as product_name,
             SUM(oi.allocated_revenue) as revenue, SUM(oi.qty) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.report_id = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY oi.sku, oi.product_name
      HAVING SUM(oi.qty) > 0
      ORDER BY revenue ASC, qty ASC
      LIMIT 5
    `).all(targetReportId, ...notCountedStatuses) as any[];

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

    const openaiPresent = !!(process.env.OPENAI_API_KEY || '').toString().trim();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[analysis/generate] cwd=${process.cwd()} openaiPresent=${openaiPresent}`);
    }

    let narrative: any = {
      summary: '',
      conversion_insight: '',
      pricing_suggestions: '',
      growth_opportunities: []
    };

    if (openaiPresent) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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
            response_format: { type: 'json_object' }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            narrative = {
              summary: parsed.summary || narrative.summary,
              conversion_insight: parsed.conversion_insight || narrative.conversion_insight,
              pricing_suggestions: parsed.pricing_suggestions || narrative.pricing_suggestions,
              growth_opportunities: parsed.growth_opportunities || []
            };
          } else {
            narrative = {
              summary: 'تعذر توليد السرد الذكي حالياً.',
              conversion_insight: '',
              pricing_suggestions: '',
              growth_opportunities: []
            };
          }
        }
      } catch (e) {
        narrative = {
          summary: 'تعذر توليد السرد الذكي حالياً.',
          conversion_insight: '',
          pricing_suggestions: '',
          growth_opportunities: []
        };
      }
    } else {
      narrative = {
        summary: 'تم تعطيل السرد الذكي (لا يوجد مفتاح OpenAI).',
        conversion_insight: 'غير متاح بدون مفتاح OpenAI.',
        pricing_suggestions: 'أضف مفتاح OpenAI للحصول على توصيات.',
        growth_opportunities: []
      };
    }

    // Build stable aiNarrative object
    const toArray = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean);
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

    const sold = await prepare(`
      SELECT COALESCE(oi.sku,'') as sku, COALESCE(oi.product_name,'') as name,
             SUM(oi.qty) as qty, SUM(oi.allocated_revenue) as revenue_sar
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.report_id = ? AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
      GROUP BY COALESCE(oi.sku,''), COALESCE(oi.product_name,'')
    `).all(targetReportId, ...notCountedStatuses) as any[];

    const normalizeTitle = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const findProductBySku = async (sku: string): Promise<any | null> => {
      if (!sku) return null;
      const row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(sku,'')) = ?
        ORDER BY (CASE WHEN COALESCE(reportId,'') = ? THEN 1 ELSE 0 END) DESC, COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, sku.trim(), targetReportId) as any;
      return row || null;
    };
    const findProductByTitle = async (title: string): Promise<any | null> => {
      const t = normalizeTitle(title);
      if (!t) return null;
      let row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(title,'')) = ?
        AND COALESCE(reportId,'') = ?
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, t, targetReportId) as any;
      if (row) return row;
      row = await prepare(`
        SELECT * FROM products 
        WHERE userId = ? AND TRIM(COALESCE(title,'')) = ?
        ORDER BY COALESCE(updatedAt,0) DESC, COALESCE(createdAt,0) DESC
        LIMIT 1
      `).get(user.id, t) as any;
      return row || null;
    };
    const hasCosts = async (productId: string): Promise<boolean> => {
      const r = await prepare(`SELECT 1 FROM product_costs WHERE product_id = ?`).get(productId) as any;
      return !!r;
    };
    const getCosts = async (productId: string): Promise<any | null> => {
      const c = await prepare(`SELECT * FROM product_costs WHERE product_id = ?`).get(productId) as any;
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
      let prod: any | null = null;
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

    // Compute weekly window in Riyadh (UTC+3)
    const nowMs = Date.now();
    const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
    const d = new Date(nowMs + RIYADH_OFFSET_MS);
    const day = d.getUTCDay(); // 0..6 (Sun=0)
    const daysSinceSaturday = (day + 1) % 7; // Sat=6 -> 0
    const dayMs = 24 * 60 * 60 * 1000;
    const midnightRiyadhUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - RIYADH_OFFSET_MS;
    const startOfWeek = midnightRiyadhUtcMs - daysSinceSaturday * dayMs;
    const endOfWeek = startOfWeek + 7 * dayMs - 1;

    // Build canonical hash from sold rows + filters + window
    const canonRows = sold.map(r => ({
      sku: (r.sku || '').trim(),
      name: (r.name || '').replace(/\s+/g, ' ').trim().toLowerCase(),
      qty: r.qty || 0,
      revenueHalala: Math.round(((r.revenue_sar || 0) * 100))
    })).sort((a, b) => {
      const ak = `${a.sku}|${a.name}`; const bk = `${b.sku}|${b.name}`;
      return ak.localeCompare(bk);
    });
    const hashInput = JSON.stringify({
      notCountedStatuses,
      window: [startOfWeek, endOfWeek],
      items: canonRows
    });
    const sourceHash = createHash('sha256').update(hashInput).digest('hex');

    // Dedup snapshots by (user, sourceHash)
    let deduped = false;
    let snapshotId: string;
    const existing = await dbService.getSnapshotByHash(user.id, sourceHash);
    if (existing) {
      deduped = true;
      snapshotId = existing.id;
      const finalReportJson = JSON.stringify({
        ...JSON.parse(reportPayload),
        snapshot: { id: snapshotId, deduped, sourceHash, timeRangeStart: startOfWeek, timeRangeEnd: endOfWeek }
      });
      await dbService.updateReportJson(targetReportId, finalReportJson);
      const updated = await dbService.getReportById(targetReportId);
      return NextResponse.json(updated);
    } else {
      snapshotId = randomUUID();
      if (user.plan === 'free' && (user.freeReportsUsed || 0) >= 2) {
        return NextResponse.json({ error: 'Free limit reached. Upgrade to continue.' }, { status: 403 });
      }
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
        snapshot: { id: snapshotId, deduped, sourceHash, timeRangeStart: startOfWeek, timeRangeEnd: endOfWeek }
      });
      await dbService.updateReportJson(targetReportId, finalReportJson);
      await dbService.incrementFreeReports(user.id);
      const updated = await dbService.getReportById(targetReportId);
      return NextResponse.json(updated);
    }

  } catch (error) {
    console.error('Generate Analysis Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
