'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

type ProductRow = {
  primaryProductId: string | null;
  identityKey: string;
  sku: string | null;
  externalId: string | null;
  name: string;
  latestPriceHalala: number | null;
  costs: {
    purchase_cost_halala: number;
    labor_cost_halala: number;
    shipping_cost_halala: number;
    packaging_cost_halala: number;
    ads_cost_per_unit_halala: number;
    payment_fee_percent_bps: number;
  };
  computed: {
    totalCostHalala: number | null;
    profitHalala: number | null;
    marginPercent: number | null;
  };
};

function halalaToSar(h: number | null | undefined) {
  if (h == null) return '—';
  return (h / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function CostsPage() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [soldOnly, setSoldOnly] = useState(false);
  const [dropship, setDropship] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (soldOnly) params.set('soldInLatest', '1');
    const res = await fetch('/api/costs' + (params.toString() ? `?${params.toString()}` : ''), { cache: 'no-store' });
    const data = await res.json();
    setRows(data.products || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onEdit = (r: ProductRow) => {
    setEditing(r.identityKey);
    setDropship(false);
    setShowAdvanced(false);
    setForm({
      purchase_cost_sar: (r.costs.purchase_cost_halala || 0) / 100,
      labor_cost_sar: (r.costs.labor_cost_halala || 0) / 100,
      shipping_cost_sar: (r.costs.shipping_cost_halala || 0) / 100,
      packaging_cost_sar: (r.costs.packaging_cost_halala || 0) / 100,
      ads_cost_per_unit_sar: (r.costs.ads_cost_per_unit_halala || 0) / 100,
      payment_fee_percent: (r.costs.payment_fee_percent_bps || 0) / 100
    });
  };

  const onSave = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/costs/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityKey: editing, costs: form })
    });
    setSaving(false);
    setEditing(null);
    await load();
  };

  // Live summary preview
  const renderSummary = (r: ProductRow) => {
    const priceHalala = r.latestPriceHalala ?? 0;
    if (!priceHalala) {
      return (
        <div className="text-xs text-gray-500">{t("costs.summary.noPrice")}</div>
      );
    }
    const num = (v: any) => {
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return isFinite(n) ? n : 0;
    };
    const purchase = num(form.purchase_cost_sar || 0);
    const labor = num(form.labor_cost_sar || 0);
    const shipping = num(form.shipping_cost_sar || 0);
    const packaging = num(form.packaging_cost_sar || 0);
    const ads = num(form.ads_cost_per_unit_sar || 0);
    const feePct = num(form.payment_fee_percent || 0);
    const priceSar = (priceHalala / 100);
    const feesSar = Math.round(priceHalala * Math.round(feePct * 100) / 10000) / 100;
    const totalCostSar = purchase + (dropship ? 0 : labor) + shipping + (dropship ? 0 : packaging) + ads + feesSar;
    const profitSar = priceSar - totalCostSar;
    const margin = priceSar > 0 ? Math.round((profitSar / priceSar) * 10000) / 100 : 0;
    const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return (
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-gray-500">{t("costs.summary.salePrice")}</div>
          <div className="font-bold">{fmt(priceSar)} SAR</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.totalCost")}</div>
          <div className="font-bold">{fmt(totalCostSar)} SAR</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.netProfit")}</div>
          <div className="font-bold">{fmt(profitSar)} SAR</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.margin")}</div>
          <div className="font-bold">{fmt(margin)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("costs.title")}</h1>
        <Link href="/dashboard" className="text-sm text-isaudi-green">{t("costs.backToDashboard")}</Link>
      </div>
      <p className="text-sm text-gray-600">{t("costs.description")}</p>
      
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <input
          type="text"
          placeholder={t("costs.search.placeholder")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full md:flex-1 border rounded-md px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={soldOnly}
            onChange={e => setSoldOnly(e.target.checked)}
          />
          {t("costs.filter.soldOnly")}
        </label>
        <button onClick={load} className="px-4 py-2 rounded-md bg-isaudi-green text-white hover:opacity-90">
          {t("costs.filter.button")}
        </button>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-right">{t("costs.table.product")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.sku")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.price")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.totalCost")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.netProfit")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.margin")}</th>
                <th className="px-4 py-3 text-right">{t("costs.table.edit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t("costs.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t("costs.empty")}</td></tr>
              ) : rows.map(r => {
                const isEditing = editing === r.identityKey;
                return (
                  <React.Fragment key={r.primaryProductId || r.identityKey}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.sku || "—"}</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.latestPriceHalala)} SAR</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.computed.totalCostHalala)} SAR</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.computed.profitHalala)} SAR</td>
                      <td className="px-4 py-3 text-gray-800">{r.computed.marginPercent == null ? "—" : `${r.computed.marginPercent}%`}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => onEdit(r)} className="px-3 py-1.5 text-sm rounded-md bg-isaudi-green text-white hover:opacity-90">
                          {t("costs.table.edit")}
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
                            <div className="flex-1">
                              <div className="mb-3 flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={dropship}
                                    onChange={e => {
                                      const on = e.target.checked;
                                      setDropship(on);
                                      if (on) {
                                        setForm((prev: any) => ({
                                          ...prev,
                                          labor_cost_sar: 0,
                                          packaging_cost_sar: 0,
                                          payment_fee_percent: (prev.payment_fee_percent == null || prev.payment_fee_percent === 0) ? 2.5 : prev.payment_fee_percent
                                        }));
                                      }
                                    }}
                                  />
                                  {t("costs.dropship.label")}
                                </label>
                                <span className="text-xs text-gray-500">{t("costs.dropship.hint")}</span>
                              </div>
                              {!dropship && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.purchase")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.purchase_cost_sar ?? 0} onChange={e => setForm({ ...form, purchase_cost_sar: parseFloat(e.target.value) })} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.labor")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.labor_cost_sar ?? 0} onChange={e => setForm({ ...form, labor_cost_sar: parseFloat(e.target.value) })} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.shipping")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.shipping_cost_sar ?? 0} onChange={e => setForm({ ...form, shipping_cost_sar: parseFloat(e.target.value) })} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.packaging")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.packaging_cost_sar ?? 0} onChange={e => setForm({ ...form, packaging_cost_sar: parseFloat(e.target.value) })} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.ads")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.ads_cost_per_unit_sar ?? 0} onChange={e => setForm({ ...form, ads_cost_per_unit_sar: parseFloat(e.target.value) })} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">{t("costs.field.paymentFee")}</label>
                                    <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.payment_fee_percent ?? 0} onChange={e => setForm({ ...form, payment_fee_percent: parseFloat(e.target.value) })} />
                                  </div>
                                </div>
                              )}
                              {dropship && (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                      <label className="text-xs text-gray-600">{t("costs.field.purchase")}</label>
                                      <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.purchase_cost_sar ?? 0} onChange={e => setForm({ ...form, purchase_cost_sar: parseFloat(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">{t("costs.field.shippingUnit")}</label>
                                      <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.shipping_cost_sar ?? 0} onChange={e => setForm({ ...form, shipping_cost_sar: parseFloat(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">{t("costs.field.paymentFee")}</label>
                                      <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.payment_fee_percent ?? 2.5} onChange={e => setForm({ ...form, payment_fee_percent: parseFloat(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">{t("costs.field.ads")}</label>
                                      <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.ads_cost_per_unit_sar ?? 0} onChange={e => setForm({ ...form, ads_cost_per_unit_sar: parseFloat(e.target.value) })} />
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowAdvanced(v => !v)}
                                      className="text-xs text-isaudi-green"
                                    >
                                      {showAdvanced ? t("costs.advanced.toggle.hide") : t("costs.advanced.toggle.show")}
                                    </button>
                                  </div>
                                  {showAdvanced && (
                                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <div>
                                        <label className="text-xs text-gray-600">{t("costs.field.labor")}</label>
                                        <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.labor_cost_sar ?? 0} onChange={e => setForm({ ...form, labor_cost_sar: parseFloat(e.target.value) })} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600">{t("costs.field.packaging")}</label>
                                        <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1" value={form.packaging_cost_sar ?? 0} onChange={e => setForm({ ...form, packaging_cost_sar: parseFloat(e.target.value) })} />
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="w-full lg:w-80">
                              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                                <div className="text-sm font-medium mb-2">{t("costs.summary.cardTitle")}</div>
                                {renderSummary(r)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-3">
                            <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-md bg-isaudi-green text-white hover:opacity-90 disabled:opacity-60">
                              {t("costs.actions.save")}
                            </button>
                            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border">
                              {t("costs.actions.cancel")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
