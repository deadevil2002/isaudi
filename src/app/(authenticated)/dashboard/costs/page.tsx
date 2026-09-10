'use client';
import React, { useEffect, useState } from 'react';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { getLoadViewState } from "@/lib/ui/load-state";

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

type CostForm = Partial<{
  purchase_cost_sar: number;
  labor_cost_sar: number;
  shipping_cost_sar: number;
  packaging_cost_sar: number;
  ads_cost_per_unit_sar: number;
  payment_fee_percent: number;
}>;

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
  const [form, setForm] = useState<CostForm>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [soldOnly, setSoldOnly] = useState(false);
  const [dropship, setDropship] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const viewState = getLoadViewState({
    loading,
    hasError: Boolean(fetchError),
    itemCount: rows.length,
  });
  const currency = t("common.currency.short");

  const load = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (soldOnly) params.set('soldInLatest', '1');
      const res = await fetch('/api/costs' + (params.toString() ? `?${params.toString()}` : ''), { cache: 'no-store' });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (!Array.isArray(data?.products)) throw new Error("Invalid response");
      setRows(data.products);
    } catch {
      setFetchError(t("costs.error.fetch"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Initial request only. Filters are submitted explicitly through the filter button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEdit = (r: ProductRow) => {
    setEditing(r.identityKey);
    setDropship(false);
    setShowAdvanced(false);
    setSaveError(null);
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
    setSaveError(null);
    try {
      const res = await fetch('/api/costs/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityKey: editing, costs: form })
      });
      if (!res.ok) throw new Error("Save failed");
      await res.json();
      setEditing(null);
      await load();
    } catch {
      setSaveError(t("costs.error.save"));
    } finally {
      setSaving(false);
    }
  };

  // Live summary preview
  const renderSummary = (r: ProductRow) => {
    const priceHalala = r.latestPriceHalala ?? 0;
    if (!priceHalala) {
      return (
        <div className="text-xs text-gray-500">{t("costs.summary.noPrice")}</div>
      );
    }
    const num = (value: unknown): number => {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
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
          <div className="font-bold">{fmt(priceSar)} {currency}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.totalCost")}</div>
          <div className="font-bold">{fmt(totalCostSar)} {currency}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.netProfit")}</div>
          <div className="font-bold text-isaudi-green">{fmt(profitSar)} {currency}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("costs.summary.margin")}</div>
          <div className="font-bold">{fmt(margin)}%</div>
        </div>
      </div>
    );
  };

  const renderEditForm = (r: ProductRow) => (
    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 shadow-sm mt-2 mb-4">
      <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dropship}
                onChange={e => {
                  const on = e.target.checked;
                  setDropship(on);
                  if (on) {
                    setForm((prev) => ({
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
        <div className="w-full lg:w-80 shrink-0">
          <div className="border border-gray-200 rounded-lg p-3 bg-white h-full shadow-sm">
            <div className="text-sm font-medium mb-2">{t("costs.summary.cardTitle")}</div>
            {renderSummary(r)}
          </div>
        </div>
      </div>
      {saveError && (
        <div className="mt-4 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
          {saveError}
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <button onClick={onSave} disabled={saving} className="min-h-11 rounded-lg bg-isaudi-green px-4 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-60">
          {saving ? t("costs.saving") : t("costs.actions.save")}
        </button>
        <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors">
          {t("costs.actions.cancel")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("costs.title")}</h1>
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
        <button onClick={load} className="min-h-11 w-full rounded-md bg-isaudi-green px-4 py-2 text-white hover:opacity-90 md:w-auto">
          {t("costs.filter.button")}
        </button>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-start">{t("costs.table.product")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.sku")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.price")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.totalCost")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.netProfit")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.margin")}</th>
                <th className="px-4 py-3 text-start">{t("costs.table.edit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {viewState === "loading" ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6">
                    <div className="space-y-3" aria-label={t("costs.loading")}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : viewState === "error" ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center">
                    <div className="text-red-600 mb-2">{fetchError}</div>
                    <button onClick={load} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50">{t("costs.retry")}</button>
                  </td>
                </tr>
              ) : viewState === "empty" ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t("costs.empty")}</td></tr>
              ) : rows.map(r => {
                const isEditing = editing === r.identityKey;
                return (
                  <React.Fragment key={r.primaryProductId || r.identityKey}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.sku || "—"}</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.latestPriceHalala)} {currency}</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.computed.totalCostHalala)} {currency}</td>
                      <td className="px-4 py-3 text-gray-800">{halalaToSar(r.computed.profitHalala)} {currency}</td>
                      <td className="px-4 py-3 text-gray-800">{r.computed.marginPercent == null ? "—" : `${r.computed.marginPercent}%`}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => onEdit(r)} className="px-3 py-1.5 text-sm rounded-md bg-isaudi-green text-white hover:opacity-90">
                          {t("costs.table.edit")}
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={7} className="px-4 py-4">
                          {renderEditForm(r)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="flex flex-col md:hidden divide-y divide-gray-100">
          {viewState === "loading" ? (
            <div className="space-y-3 p-4" aria-label={t("costs.loading")}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : viewState === "error" ? (
            <div className="p-6 text-center">
              <div className="text-red-600 mb-2">{fetchError}</div>
              <button onClick={load} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50">{t("costs.retry")}</button>
            </div>
          ) : viewState === "empty" ? (
            <div className="p-6 text-center text-gray-500">{t("costs.empty")}</div>
          ) : rows.map(r => {
            const isEditing = editing === r.identityKey;
            return (
              <div key={r.primaryProductId || r.identityKey} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50">
                <div>
                  <div className="font-medium text-gray-800 text-sm leading-tight mb-1">{r.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{r.sku || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">{t("costs.table.price")}</div>
                    <div>{halalaToSar(r.latestPriceHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">{t("costs.table.totalCost")}</div>
                    <div>{halalaToSar(r.computed.totalCostHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">{t("costs.table.netProfit")}</div>
                    <div className="font-medium text-isaudi-green">{halalaToSar(r.computed.profitHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">{t("costs.table.margin")}</div>
                    <div>{r.computed.marginPercent == null ? "—" : `${r.computed.marginPercent}%`}</div>
                  </div>
                </div>

                {!isEditing && (
                  <button onClick={() => onEdit(r)} className="self-start mt-1 px-4 py-1.5 text-sm rounded-lg bg-isaudi-green/10 text-isaudi-green border border-isaudi-green/20 hover:bg-isaudi-green/20 transition-colors">
                    {t("costs.table.edit")}
                  </button>
                )}

                {isEditing && (
                  <div className="mt-2 -mx-2">
                    {renderEditForm(r)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
