import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getDb } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/utils';

function computeComputed(latestPriceHalala: number | null, costs: {
  purchase_cost_halala: number;
  labor_cost_halala: number;
  shipping_cost_halala: number;
  packaging_cost_halala: number;
  ads_cost_per_unit_halala: number;
  payment_fee_percent_bps: number;
}) {
  if (latestPriceHalala == null) {
    return {
      totalCostHalala: null,
      profitHalala: null,
      marginPercent: null
    };
  }
  const fixed = (costs.purchase_cost_halala || 0)
    + (costs.labor_cost_halala || 0)
    + (costs.shipping_cost_halala || 0)
    + (costs.packaging_cost_halala || 0)
    + (costs.ads_cost_per_unit_halala || 0);
  const fees = Math.round((latestPriceHalala * (costs.payment_fee_percent_bps || 0)) / 10000);
  const total = fixed + fees;
  const profit = latestPriceHalala - total;
  const margin = latestPriceHalala > 0 ? Math.round((profit / latestPriceHalala) * 10000) / 100 : null;
  return {
    totalCostHalala: total,
    profitHalala: profit,
    marginPercent: margin
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const soldInLatest = searchParams.get('soldInLatest') === '1';
  const db = await getDb();
  const prepare = db.prepare.bind(db);

  let identities = await dbService.listDistinctProductsForUser(user.id);

  if (q) {
    identities = identities.filter(p => 
      (p.sku || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    );
  }

  if (soldInLatest) {
    const latest = await dbService.getLatestReport(user.id);
    if (latest) {
      const items = await prepare(`
        SELECT sku, product_name, SUM(qty) AS qty
        FROM order_items
        WHERE report_id = ?
        GROUP BY sku, product_name
      `).all(latest.id) as Array<{ sku: string | null, product_name: string | null, qty: number }>;
      const soldSku = new Set(items.filter(i => (i.sku || '').trim() !== '').map(i => (i.sku || '').trim()));
      const soldNames = new Set(items.filter(i => (i.product_name || '').trim() !== '').map(i => (i.product_name || '').replace(/\s+/g, ' ').trim().toLowerCase()));
      identities = identities.filter(p => {
        if (p.sku && soldSku.has(p.sku.trim())) return true;
        const name = (p.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return name && soldNames.has(name);
      });
    } else {
      identities = [];
    }
  }

  const products = [] as Array<{
    primaryProductId: string | null;
    identityKey: string;
    sku: string | null;
    externalId: string | null;
    name: string;
    latestPriceHalala: number | null;
    costs: any;
    computed: ReturnType<typeof computeComputed>;
  }>;

  for (const id of identities) {
    const costs = await dbService.getCostsByIdentity(id.identityKey, user.id);
    const computed = computeComputed(id.latestPriceHalala, costs);
    products.push({
      primaryProductId: (id as any).productIds?.[0] || null,
      identityKey: id.identityKey,
      sku: id.sku,
      externalId: id.externalId,
      name: id.name,
      latestPriceHalala: id.latestPriceHalala,
      costs,
      computed
    });
  }
  return NextResponse.json({ products });
}
