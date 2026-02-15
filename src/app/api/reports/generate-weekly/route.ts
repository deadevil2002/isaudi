import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { dbService } from '@/lib/db/service';
import { requirePremiumUser } from '@/lib/auth/utils';
import { createHash, randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const prem = await requirePremiumUser();
    if (!prem.ok) {
      return NextResponse.json({ error: prem.error }, { status: prem.status });
    }
    const user = prem.user;

    const nowMs = Date.now();
    const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
    const d = new Date(nowMs + RIYADH_OFFSET_MS);
    const day = d.getUTCDay();
    const daysSinceSaturday = (day + 1) % 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const midnightRiyadhUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - RIYADH_OFFSET_MS;
    const startOfWeek = midnightRiyadhUtcMs - daysSinceSaturday * dayMs;
    const endOfWeek = startOfWeek + 7 * dayMs - 1;

    const existing = db
      .prepare(
        `
        SELECT * FROM report_snapshots
        WHERE user_id = ? AND time_range_start = ? AND time_range_end = ?
        LIMIT 1
      `
      )
      .get(user.id, startOfWeek, endOfWeek) as any;

    if (existing) {
      return NextResponse.json({
        snapshot: {
          id: existing.id,
          createdAt: existing.created_at,
          timeRangeStart: existing.time_range_start,
          timeRangeEnd: existing.time_range_end,
          grossSalesHalala: existing.gross_sales_halala,
          grossSales: (existing.gross_sales_halala || 0) / 100,
          ordersCount: existing.orders_count,
          totalProfitHalala: existing.total_profit_halala,
          totalProfit: (existing.total_profit_halada || 0) / 100,
          marginPct: (existing.margin_pct_x100 || 0) / 100,
          marginPctX100: existing.margin_pct_x100
        }
      });
    }

    const latestReport = dbService.getLatestReport(user.id);
    if (!latestReport) {
    return NextResponse.json({ error: 'No report context. Data files missing.' }, { status: 400 });
    }

    const notCountedStatuses = ['ملغي', 'محذوف'];

    const salesRow = db
      .prepare(
        `
        SELECT COALESCE(SUM(oi.allocated_revenue),0) as revenue_sar
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.userId = ? 
          AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
          AND o.createdAt BETWEEN ? AND ?
      `
      )
      .get(user.id, ...notCountedStatuses, startOfWeek, endOfWeek) as any;

    const ordersRow = db
      .prepare(
        `
        SELECT COUNT(DISTINCT o.id) as cnt
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.userId = ? 
          AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
          AND o.createdAt BETWEEN ? AND ?
      `
      )
      .get(user.id, ...notCountedStatuses, startOfWeek, endOfWeek) as any;

    const sold = db
      .prepare(
        `
        SELECT 
          COALESCE(oi.sku,'') as sku,
          COALESCE(oi.product_name,'') as name,
          SUM(oi.qty) as qty,
          SUM(oi.allocated_revenue) as revenue_sar
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.userId = ?
          AND COALESCE(o.status,'') NOT IN (${notCountedStatuses.map(() => '?').join(',')})
          AND o.createdAt BETWEEN ? AND ?
        GROUP BY COALESCE(oi.sku,''), COALESCE(oi.product_name,'')
      `
      )
      .all(user.id, ...notCountedStatuses, startOfWeek, endOfWeek) as any[];

    const normalizeTitle = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

    let totalProfitHalala = 0;
    let missingCostProductsCount = 0;
    let missingCostSalesHalala = 0;

    for (const r of sold) {
      const qty = r.qty || 0;
      if (qty <= 0) continue;
      const sku = (r.sku || '').trim();
      const title = normalizeTitle(r.name || '');
      const identityKey = sku ? `sku:${sku}` : `name:${title.toLowerCase()}`;

      const costs = dbService.getCostsByIdentity(identityKey, user.id);

      const revenueHalala = Math.round(((r.revenue_sar || 0) * 100)) || 0;
      if (revenueHalala <= 0) continue;

      const hasConfiguredCosts = costs && costs.is_configured === 1;
      if (!hasConfiguredCosts) {
        missingCostProductsCount++;
        missingCostSalesHalala += revenueHalala;
        continue;
      }

      const sellPriceHalala =
        qty > 0 ? Math.round(revenueHalala / qty) : 0;

      const fixed =
        (costs.purchase_cost_halala || 0) +
        (costs.labor_cost_halala || 0) +
        (costs.shipping_cost_halala || 0) +
        (costs.packaging_cost_halala || 0) +
        (costs.ads_cost_per_unit_halala || 0);

      const fee = Math.round(
        (sellPriceHalala * (costs.payment_fee_percent_bps || 0)) / 10000
      );

      const totalCostPerUnit = fixed + fee;
      const profitPerUnit = sellPriceHalala - totalCostPerUnit;
      const profitTotal = profitPerUnit * qty;

      totalProfitHalala += profitTotal;
    }

    const grossSalesHalala = Math.round(((salesRow?.revenue_sar || 0) * 100)) || 0;
    const ordersCount = ordersRow?.cnt || 0;

    const marginPctX100 =
      grossSalesHalala > 0
        ? Math.round((totalProfitHalala / grossSalesHalala) * 10000)
        : 0;

    const snapshotId = randomUUID();
    const sourceHash = createHash('sha256')
      .update(`weekly:${startOfWeek}:${endOfWeek}`)
      .digest('hex');

    dbService.insertSnapshot({
      id: snapshotId,
      user_id: user.id,
      created_at: nowMs,
      source_hash: sourceHash,
      time_range_start: startOfWeek,
      time_range_end: endOfWeek,
      report_id: latestReport.id,
      gross_sales_halala: grossSalesHalala,
      orders_count: ordersCount,
      total_profit_halala: totalProfitHalala,
      margin_pct_x100: marginPctX100,
      missing_cost_products_count: missingCostProductsCount,
      missing_cost_sales_halala: missingCostSalesHalala,
      report_json: latestReport.reportJson
    });

    return NextResponse.json({
      snapshot: {
        id: snapshotId,
        createdAt: nowMs,
        timeRangeStart: startOfWeek,
        timeRangeEnd: endOfWeek,
        grossSalesHalala,
        grossSales: grossSalesHalala / 100,
        ordersCount,
        totalProfitHalala,
        totalProfit: totalProfitHalala / 100,
        marginPct: marginPctX100 / 100,
        marginPctX100
      }
    });
  } catch (error) {
    console.error('Generate weekly snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
