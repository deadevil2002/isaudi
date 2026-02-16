import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getCurrentUser } from '@/lib/auth/utils';

// API accepts SAR values for cost fields and a percent for payment fee.
// Server converts SAR -> halala (integer) and percent -> basis points (bps).
function toHalala(sar: any): number {
  const n = typeof sar === 'string' ? parseFloat(sar) : sar;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}
function toBps(percent: any): number {
  const n = typeof percent === 'string' ? parseFloat(percent) : percent;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { identityKey, costs } = body || {};
  if (!identityKey || !costs) {
    return NextResponse.json({ error: 'identityKey and costs are required' }, { status: 400 });
  }

  const payload = {
    purchase_cost_halala: toHalala(costs.purchase_cost_sar ?? 0),
    labor_cost_halala: toHalala(costs.labor_cost_sar ?? 0),
    shipping_cost_halala: toHalala(costs.shipping_cost_sar ?? 0),
    packaging_cost_halala: toHalala(costs.packaging_cost_sar ?? 0),
    ads_cost_per_unit_halala: toHalala(costs.ads_cost_per_unit_sar ?? 0),
    payment_fee_percent_bps: toBps(costs.payment_fee_percent ?? 0)
  };

  try {
    await dbService.upsertCostsByIdentity(identityKey, user.id, payload);
    // Return merged view with computed fields like GET
    const identities = await dbService.listDistinctProductsForUser(user.id);
    const found = identities.find(p => p.identityKey === identityKey);
    const latestPriceHalala = found?.latestPriceHalala ?? null;
    const updatedCosts = await dbService.getCostsByIdentity(identityKey, user.id);
    const fees = Math.round(((latestPriceHalala ?? 0) * (updatedCosts.payment_fee_percent_bps || 0)) / 10000);
    const totalCostHalala = latestPriceHalala == null ? null :
      ((updatedCosts.purchase_cost_halala || 0)
      + (updatedCosts.labor_cost_halala || 0)
      + (updatedCosts.shipping_cost_halala || 0)
      + (updatedCosts.packaging_cost_halala || 0)
      + (updatedCosts.ads_cost_per_unit_halala || 0)
      + fees);
    const profitHalala = latestPriceHalala == null || totalCostHalala == null ? null : (latestPriceHalala - totalCostHalala);
    const marginPercent = latestPriceHalala && totalCostHalala != null && latestPriceHalala > 0
      ? Math.round(((profitHalala as number) / latestPriceHalala) * 10000) / 100
      : null;
    return NextResponse.json({
      identityKey,
      costs: updatedCosts,
      computed: {
        totalCostHalala,
        profitHalala,
        marginPercent
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to upsert costs' }, { status: 500 });
  }
}
