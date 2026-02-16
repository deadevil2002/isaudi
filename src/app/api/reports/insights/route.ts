import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { dbService } from '@/lib/db/service';
import { requirePremiumUser } from '@/lib/auth/utils';

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) {
    if (cur === 0) return 0;
    return null;
  }
  return ((cur - prev) / prev) * 100;
}

export async function GET(req: NextRequest) {
  try {
    const prem = await requirePremiumUser();
    if (!prem.ok) {
      return NextResponse.json({ error: prem.error }, { status: prem.status });
    }
    const user = prem.user;

    const { searchParams } = new URL(req.url);
    const currentId = searchParams.get('current');
    const previous = searchParams.get('previous') || 'auto';
    if (!currentId) {
      return NextResponse.json({ error: 'current is required' }, { status: 400 });
    }

    const cur = await dbService.getSnapshotById(user.id, currentId);
    if (!cur) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    let prev: any = null;
    if (previous === 'auto') {
      prev = await dbService.getPreviousSnapshot(user.id, cur.time_range_start);
    } else if (previous) {
      prev = await dbService.getSnapshotById(user.id, previous);
    }

    const curSales = cur.gross_sales_halala || 0;
    const prevSales = prev ? (prev.gross_sales_halala || 0) : 0;
    const curProfit = cur.total_profit_halala || 0;
    const prevProfit = prev ? (prev.total_profit_halala || 0) : 0;
    const curMargin = (cur.margin_pct_x100 || 0) / 100;
    const prevMargin = prev ? ((prev.margin_pct_x100 || 0) / 100) : 0;

    const salesDeltaPct = prev ? pctDelta(curSales, prevSales) : null;
    const profitDeltaPct = prev ? pctDelta(curProfit, prevProfit) : null;
    const marginDeltaPct = prev ? (curMargin - prevMargin) : null;

    let status: 'improved' | 'declined' | 'no_change' = 'no_change';
    const absSales = salesDeltaPct == null ? 0 : Math.abs(salesDeltaPct);
    const absProfit = profitDeltaPct == null ? 0 : Math.abs(profitDeltaPct);
    const absMargin = marginDeltaPct == null ? 0 : Math.abs(marginDeltaPct);
    if (prev) {
      if (absSales < 0.5 && absProfit < 0.5 && absMargin < 0.2) {
        status = 'no_change';
      } else {
        const score =
          (salesDeltaPct || 0) * 0.5 +
          (profitDeltaPct || 0) * 0.5 +
          (marginDeltaPct || 0) * 1.0;
        status = score >= 0 ? 'improved' : 'declined';
      }
    }

    const notCountedStatuses = ['ملغي', 'محذوف'];
    const db = await getDb();
    const rows = db
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
      .all(user.id, ...notCountedStatuses, cur.time_range_start, cur.time_range_end) as any[];

    const normalizeTitle = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const products: {
      name: string;
      sku: string | null;
      revenueHalala: number;
      profitHalala: number;
      marginPct: number;
    }[] = [];
    let missingCosts = false;

    for (const r of rows) {
      const qty = r.qty || 0;
      const revenueHalala = Math.round(((r.revenue_sar || 0) * 100)) || 0;
      if (qty <= 0 || revenueHalala <= 0) continue;

      const sku = (r.sku || '').trim();
      const title = normalizeTitle(r.name || '');
      const displayName = title || sku || 'غير مسمى';
      const identityKey = sku ? `sku:${sku}` : `name:${title.toLowerCase()}`;

      const costs = await dbService.getCostsByIdentity(identityKey, user.id);
      const hasConfiguredCosts = costs && costs.is_configured === 1;
      if (!hasConfiguredCosts) {
        missingCosts = true;
      }

      const sellPriceHalala = qty > 0 ? Math.round(revenueHalala / qty) : 0;

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
      const profitTotalHalala = !hasConfiguredCosts ? 0 : profitPerUnit * qty;
      const marginPct =
        revenueHalala > 0 ? (profitTotalHalala / revenueHalala) * 100 : 0;

      products.push({
        name: displayName,
        sku: sku || null,
        revenueHalala,
        profitHalala: profitTotalHalala,
        marginPct
      });
    }

    const sortedByProfit = [...products].sort(
      (a, b) => (b.profitHalala || 0) - (a.profitHalala || 0)
    );
    const topProfitProducts = sortedByProfit.slice(0, 3).map((p) => ({
      name: p.name,
      sku: p.sku,
      profitSar: Math.round((p.profitHalala || 0)) / 100,
      marginPct: Math.round((p.marginPct || 0) * 100) / 100
    }));

    const sortedByMargin = [...products].sort(
      (a, b) => (a.marginPct || 0) - (b.marginPct || 0)
    );
    const lowMarginProducts = sortedByMargin.slice(0, 3).map((p) => ({
      name: p.name,
      sku: p.sku,
      profitSar: Math.round((p.profitHalala || 0)) / 100,
      marginPct: Math.round((p.marginPct || 0) * 100) / 100
    }));

    const insightCandidates: string[] = [];

    if (prev) {
      if (status === 'improved') {
        insightCandidates.push('الأداء هذا الأسبوع تحسن مقارنة بالأسبوع السابق.');
      } else if (status === 'declined') {
        insightCandidates.push('الأداء هذا الأسبوع تراجع مقارنة بالأسبوع السابق.');
      } else {
        insightCandidates.push('الأداء هذا الأسبوع قريب من الأسبوع السابق.');
      }
    } else {
      insightCandidates.push('هذا أول أسبوع في السجل، ما فيه أسبوع سابق للمقارنة.');
    }

    if (topProfitProducts.length > 0 && status === 'improved') {
      const names = topProfitProducts.map((p) => p.name).slice(0, 3).join(' و ');
      insightCandidates.push(
        `أكبر سبب للتحسن: زيادة الربح في منتجات ${names}.`
      );
    }

    if (lowMarginProducts.length > 0 && status === 'declined') {
      const names = lowMarginProducts.map((p) => p.name).slice(0, 3).join(' و ');
      insightCandidates.push(
        `الهامش نزل بسبب هامش ضعيف في منتجات ${names}.`
      );
    }

    if (missingCosts) {
      insightCandidates.push(
        'بعض المنتجات المباعة بدون تكاليف — أدخل التكاليف عشان تظهر ربحيتها بدقة.'
      );
    }

    const insights = insightCandidates.slice(0, 3);

    const actionCandidates: string[] = [];

    if (status === 'improved') {
      actionCandidates.push(
        'زد إبراز المنتجات الأعلى ربحًا في المتجر والإعلانات.'
      );
    }
    if (status === 'declined') {
      actionCandidates.push(
        'راجع أسعار المنتجات وحجم الخصومات خلال هذا الأسبوع.'
      );
    }

    if (lowMarginProducts.length > 0) {
      actionCandidates.push(
        'راجع تكلفة الشحن ورسوم الدفع للمنتجات ذات الهامش المنخفض.'
      );
    }

    if (missingCosts) {
      actionCandidates.push(
        'أدخل تكاليف المنتجات المباعة في صفحة التكاليف لتحديث ربحيتها.'
      );
    }

    if (actionCandidates.length < 3) {
      actionCandidates.push(
        'راجع تسعير أهم المنتجات وقارن الربحية مع متوسط الأسبوع.'
      );
    }
    if (actionCandidates.length < 3) {
      actionCandidates.push(
        'حدد منتجين ضعيفي الهامش وجرب تعديل السعر أو تقليل التكلفة.'
      );
    }

    const actionItems = actionCandidates.slice(0, 3);

    return NextResponse.json({
      status,
      topProfitProducts,
      lowMarginProducts,
      insights,
      actionItems
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
