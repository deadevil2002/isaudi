import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { requirePremiumUser } from '@/lib/auth/utils';

export async function GET(req: NextRequest) {
  const prem = await requirePremiumUser();
  if (!prem.ok) {
    return NextResponse.json({ error: prem.error }, { status: prem.status });
  }
  const user = prem.user;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'weekly';
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10) || 12, 52);
  if (range !== 'weekly') {
    return NextResponse.json({ error: 'Unsupported range' }, { status: 400 });
  }
  const rowsRaw = await dbService.listSnapshots(user.id, limit);
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw
    : Array.isArray((rowsRaw as any)?.results)
    ? (rowsRaw as any).results
    : Array.isArray((rowsRaw as any)?.rows)
    ? (rowsRaw as any).rows
    : [];

  const items = rows.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    timeRangeStart: r.time_range_start,
    timeRangeEnd: r.time_range_end,
    grossSalesHalala: r.gross_sales_halala,
    grossSales: (r.gross_sales_halala || 0) / 100,
    ordersCount: r.orders_count,
    totalProfitHalala: r.total_profit_halala,
    totalProfit: (r.total_profit_halala || 0) / 100,
    marginPct: (r.margin_pct_x100 || 0) / 100,
    marginPctX100: r.margin_pct_x100,
    reportId: r.report_id,
    missingCostProductsCount: r.missing_cost_products_count,
    missingCostSalesHalala: r.missing_cost_sales_halala
  }));
  return NextResponse.json({ snapshots: items });
}
