import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { requirePremiumUser } from '@/lib/auth/utils';

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) {
    if (cur === 0) return 0;
    return null; // undefined when previous is zero to avoid infinite %
  }
  return ((cur - prev) / prev) * 100;
}

export async function GET(req: NextRequest) {
  const prem = await requirePremiumUser();
  if (!prem.ok) {
    return NextResponse.json({ error: prem.error }, { status: prem.status });
  }
  const user = prem.user;
  const { searchParams } = new URL(req.url);
  const currentId = searchParams.get('current');
  const previous = searchParams.get('previous') || 'auto';
  if (!currentId) return NextResponse.json({ error: 'current is required' }, { status: 400 });

  const cur = dbService.getSnapshotById(user.id, currentId);
  if (!cur) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

  let prev: any = null;
  if (previous === 'auto') {
    prev = dbService.getPreviousSnapshot(user.id, cur.time_range_start);
  } else {
    prev = dbService.getSnapshotById(user.id, previous);
  }

  const curSales = cur.gross_sales_halala || 0;
  const prevSales = prev ? (prev.gross_sales_halala || 0) : 0;
  const curProfit = cur.total_profit_halala || 0;
  const prevProfit = prev ? (prev.total_profit_halala || 0) : 0;
  const curMargin = (cur.margin_pct_x100 || 0) / 100;
  const prevMargin = prev ? ((prev.margin_pct_x100 || 0) / 100) : 0;
  const curOrders = cur.orders_count || 0;
  const prevOrders = prev ? (prev.orders_count || 0) : 0;

  const salesDeltaPct = prev ? pctDelta(curSales, prevSales) : null;
  const profitDeltaPct = prev ? pctDelta(curProfit, prevProfit) : null;
  const marginDeltaPct = prev ? (curMargin - prevMargin) : null; // percentage points
  const ordersDelta = prev ? (curOrders - prevOrders) : null;

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

  return NextResponse.json({
    current: {
      id: cur.id,
      timeRangeStart: cur.time_range_start,
      timeRangeEnd: cur.time_range_end,
      sales: curSales / 100,
      profit: curProfit / 100,
      marginPct: curMargin,
      orders: curOrders
    },
    previous: prev ? {
      id: prev.id,
      timeRangeStart: prev.time_range_start,
      timeRangeEnd: prev.time_range_end,
      sales: prevSales / 100,
      profit: prevProfit / 100,
      marginPct: prevMargin,
      orders: prevOrders
    } : null,
    deltas: {
      salesDeltaPct,
      profitDeltaPct,
      marginDeltaPct,
      ordersDelta
    },
    status
  });
}
