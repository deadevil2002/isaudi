'use client';
import React, { useEffect, useState } from 'react';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { getLoadViewState } from "@/lib/ui/load-state";

export type ProductRow = {
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

export default function CostsPage(props?: {
  previewProps?: {
    rows?: ProductRow[];
    loadState?: 'populated' | 'loading' | 'empty' | 'error';
  };
}) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const isPreview = !!props?.previewProps;
  const previewProps = props?.previewProps;

  const [rows, setRows] = useState<ProductRow[]>(isPreview ? (previewProps?.rows || []) : []);
  const [loading, setLoading] = useState(isPreview ? previewProps?.loadState === 'loading' : true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CostForm>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [soldOnly, setSoldOnly] = useState(false);
  const [dropship, setDropship] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(
    isPreview && previewProps?.loadState === 'error' ? t("costs.error.fetch") || "Error loading costs" : null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const viewState = getLoadViewState({
    loading,
    hasError: Boolean(fetchError),
    itemCount: rows.length,
  });
  const currency = t("common.currency.short");

  const load = async () => {
    if (isPreview) return;
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
    if (isPreview) return;
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Initial request only. Filters are submitted explicitly through the filter button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

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

    if (isPreview) {
      setSaving(true);
      setTimeout(() => {
        setEditing(null);
        setSaving(false);
      }, 500);
      return;
    }

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
        <div className="text-xs text-[#94a3b8] py-4">{t("costs.summary.noPrice")}</div>
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
      <div className="mt-4 bg-[#161c24] border border-[#ffffff1a] rounded-xl p-4 grid grid-cols-2 gap-4 text-sm relative overflow-hidden">
        <div>
          <div className="text-[#94a3b8] text-xs mb-1">{t("costs.summary.salePrice")}</div>
          <div className="font-bold text-[#f0f4f8]">{fmt(priceSar)} {currency}</div>
        </div>
        <div>
          <div className="text-[#94a3b8] text-xs mb-1">{t("costs.summary.totalCost")}</div>
          <div className="font-bold text-[#f0f4f8]">{fmt(totalCostSar)} {currency}</div>
        </div>
        <div>
          <div className="text-[#94a3b8] text-xs mb-1">{t("costs.summary.netProfit")}</div>
          <div className="font-bold text-[#0fc9a7]">{fmt(profitSar)} {currency}</div>
        </div>
        <div>
          <div className="text-[#94a3b8] text-xs mb-1">{t("costs.summary.margin")}</div>
          <div className="font-bold text-[#f0f4f8]">{fmt(margin)}%</div>
        </div>
      </div>
    );
  };

  const renderEditForm = (r: ProductRow) => {
    const inputClasses = "mt-1.5 w-full bg-[#161c24] border border-[#ffffff1a] text-[#f0f4f8] rounded-xl px-3 py-2 outline-none focus:border-[#e6b95c] transition-colors placeholder:text-[#64748b]";
    return (
      <div className="p-6 border border-[#e6b95c]/20 rounded-2xl bg-[#0e1218] shadow-[0_4px_20px_rgba(0,0,0,0.3)] mt-2 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e6b95c]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-6 flex-col lg:flex-row relative z-10">
          <div className="flex-1 w-full">
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-[#f0f4f8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dropship}
                  className="w-4 h-4 rounded border-[#ffffff1a] bg-[#161c24] text-[#e6b95c] focus:ring-[#e6b95c]/50 accent-[#e6b95c]"
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
              <span className="text-xs text-[#94a3b8] bg-[#161c24] px-2 py-1 rounded-md border border-[#ffffff1a]">{t("costs.dropship.hint")}</span>
            </div>

            {!dropship && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.purchase")}</label>
                  <input aria-label={t("costs.field.purchase")} type="number" step="0.01" className={inputClasses} value={form.purchase_cost_sar ?? 0} onChange={e => setForm({ ...form, purchase_cost_sar: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.labor")}</label>
                  <input aria-label={t("costs.field.labor")} type="number" step="0.01" className={inputClasses} value={form.labor_cost_sar ?? 0} onChange={e => setForm({ ...form, labor_cost_sar: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.shipping")}</label>
                  <input aria-label={t("costs.field.shipping")} type="number" step="0.01" className={inputClasses} value={form.shipping_cost_sar ?? 0} onChange={e => setForm({ ...form, shipping_cost_sar: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.packaging")}</label>
                  <input aria-label={t("costs.field.packaging")} type="number" step="0.01" className={inputClasses} value={form.packaging_cost_sar ?? 0} onChange={e => setForm({ ...form, packaging_cost_sar: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.ads")}</label>
                  <input aria-label={t("costs.field.ads")} type="number" step="0.01" className={inputClasses} value={form.ads_cost_per_unit_sar ?? 0} onChange={e => setForm({ ...form, ads_cost_per_unit_sar: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.paymentFee")}</label>
                  <input aria-label={t("costs.field.paymentFee")} type="number" step="0.01" className={inputClasses} value={form.payment_fee_percent ?? 0} onChange={e => setForm({ ...form, payment_fee_percent: parseFloat(e.target.value) })} />
                </div>
              </div>
            )}

            {dropship && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.purchase")}</label>
                    <input aria-label={t("costs.field.purchase")} type="number" step="0.01" className={inputClasses} value={form.purchase_cost_sar ?? 0} onChange={e => setForm({ ...form, purchase_cost_sar: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.shippingUnit")}</label>
                    <input aria-label={t("costs.field.shippingUnit")} type="number" step="0.01" className={inputClasses} value={form.shipping_cost_sar ?? 0} onChange={e => setForm({ ...form, shipping_cost_sar: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.paymentFee")}</label>
                    <input aria-label={t("costs.field.paymentFee")} type="number" step="0.01" className={inputClasses} value={form.payment_fee_percent ?? 2.5} onChange={e => setForm({ ...form, payment_fee_percent: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.ads")}</label>
                    <input aria-label={t("costs.field.ads")} type="number" step="0.01" className={inputClasses} value={form.ads_cost_per_unit_sar ?? 0} onChange={e => setForm({ ...form, ads_cost_per_unit_sar: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    className="text-xs font-medium text-[#0fc9a7] hover:text-[#8ddbc9] transition-colors flex items-center gap-1"
                  >
                    {showAdvanced ? t("costs.advanced.toggle.hide") : t("costs.advanced.toggle.show")}
                  </button>
                </div>
                {showAdvanced && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 p-5 border border-[#ffffff1a] rounded-xl bg-[#161c24]/50">
                    <div>
                      <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.labor")}</label>
                      <input aria-label={t("costs.field.labor")} type="number" step="0.01" className={inputClasses} value={form.labor_cost_sar ?? 0} onChange={e => setForm({ ...form, labor_cost_sar: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#94a3b8]">{t("costs.field.packaging")}</label>
                      <input aria-label={t("costs.field.packaging")} type="number" step="0.01" className={inputClasses} value={form.packaging_cost_sar ?? 0} onChange={e => setForm({ ...form, packaging_cost_sar: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="w-full lg:w-80 shrink-0">
            <div className="border border-[#ffffff1a] rounded-xl p-5 bg-[#06090c] h-full shadow-inner">
              <div className="text-sm font-semibold text-[#f0f4f8] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0fc9a7]"></span>
                {t("costs.summary.cardTitle")}
              </div>
              {renderSummary(r)}
            </div>
          </div>
        </div>
        {saveError && (
          <div className="mt-5 text-sm font-medium text-[#ef4444] bg-[#ef4444]/10 p-3 rounded-xl border border-[#ef4444]/20 relative z-10">
            {saveError}
          </div>
        )}
        <div className="mt-6 flex gap-4 relative z-10 border-t border-[#ffffff1a] pt-5">
          <button onClick={onSave} disabled={saving} className="min-h-11 rounded-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] px-6 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60 shadow-[0_0_15px_rgba(230,185,92,0.2)]">
            {saving ? t("costs.saving") : t("costs.actions.save")}
          </button>
          <button onClick={() => setEditing(null)} className="px-6 py-2 text-sm font-medium rounded-full border border-[#ffffff1a] bg-[#161c24] text-[#f0f4f8] hover:border-[#ef4444]/50 hover:text-[#ef4444] transition-colors">
            {t("costs.actions.cancel")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-6 text-[#f0f4f8]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#f0f4f8]">{t("costs.title")}</h1>
      </div>
      <p className="text-sm text-[#94a3b8]">{t("costs.description")}</p>
      
      <div className="flex flex-col md:flex-row items-center gap-4 bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a] shadow-sm">
        <input
          type="text"
          placeholder={t("costs.search.placeholder")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full md:flex-1 border border-[#ffffff1a] bg-[#161c24] text-[#f0f4f8] rounded-full px-5 py-2.5 outline-none focus:border-[#e6b95c] transition-colors placeholder:text-[#64748b]"
        />
        <label className="flex items-center gap-3 text-sm text-[#94a3b8] cursor-pointer hover:text-[#f0f4f8] transition-colors">
          <input
            type="checkbox"
            checked={soldOnly}
            onChange={e => setSoldOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[#ffffff1a] bg-[#161c24] text-[#e6b95c] focus:ring-[#e6b95c]/50 accent-[#e6b95c]"
          />
          {t("costs.filter.soldOnly")}
        </label>
        <button onClick={load} className="min-h-11 w-full rounded-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] px-6 py-2 text-black font-semibold hover:opacity-90 md:w-auto transition-opacity shadow-[0_0_15px_rgba(230,185,92,0.2)]">
          {t("costs.filter.button")}
        </button>
      </div>
      
      <div className="bg-[#0e1218] rounded-2xl border border-[#ffffff1a] shadow-sm overflow-hidden text-[#f0f4f8]">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#161c24] text-[#94a3b8] border-b border-[#ffffff1a]">
              <tr>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.product")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.sku")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.price")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.totalCost")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.netProfit")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.margin")}</th>
                <th className="px-5 py-4 text-start font-semibold">{t("costs.table.edit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff1a]">
              {viewState === "loading" ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8">
                    <div className="space-y-4" aria-label={t("costs.loading")}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-xl bg-[#161c24] border border-[#ffffff1a]" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : viewState === "error" ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="text-[#ef4444] mb-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4 inline-block text-sm font-medium">{fetchError}</div>
                    <div>
                      <button onClick={load} className="px-6 py-2.5 text-sm font-medium rounded-full border border-[#ffffff1a] bg-[#161c24] text-[#f0f4f8] hover:border-[#e6b95c]/50 hover:text-[#e6b95c] transition-colors">{t("costs.retry")}</button>
                    </div>
                  </td>
                </tr>
              ) : viewState === "empty" ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-[#64748b] bg-[#161c24]/30">{t("costs.empty")}</td></tr>
              ) : rows.map(r => {
                const isEditing = editing === r.identityKey;
                return (
                  <React.Fragment key={r.primaryProductId || r.identityKey}>
                    <tr className="hover:bg-[#161c24]/50 transition-colors group">
                      <td className="px-5 py-4 font-medium text-[#f0f4f8]">{r.name}</td>
                      <td className="px-5 py-4 text-[#94a3b8] font-mono text-xs">{r.sku || "—"}</td>
                      <td className="px-5 py-4 text-[#f0f4f8]">{halalaToSar(r.latestPriceHalala)} {currency}</td>
                      <td className="px-5 py-4 text-[#f0f4f8]">{halalaToSar(r.computed.totalCostHalala)} {currency}</td>
                      <td className="px-5 py-4 text-[#0fc9a7] font-medium">{halalaToSar(r.computed.profitHalala)} {currency}</td>
                      <td className="px-5 py-4 text-[#f0f4f8]">{r.computed.marginPercent == null ? "—" : `${r.computed.marginPercent}%`}</td>
                      <td className="px-5 py-4">
                        <button onClick={() => onEdit(r)} className="px-4 py-1.5 text-sm font-medium rounded-full bg-[#161c24] border border-[#ffffff1a] text-[#f0f4f8] hover:border-[#e6b95c]/50 hover:text-[#e6b95c] transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                          {t("costs.table.edit")}
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-[#161c24]/30">
                        <td colSpan={7} className="px-5 py-6 border-b border-[#ffffff1a]">
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
        <div className="flex flex-col md:hidden divide-y divide-[#ffffff1a]">
          {viewState === "loading" ? (
            <div className="space-y-4 p-5" aria-label={t("costs.loading")}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-[#161c24] border border-[#ffffff1a]" />
              ))}
            </div>
          ) : viewState === "error" ? (
            <div className="p-8 text-center">
              <div className="text-[#ef4444] mb-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4 text-sm font-medium">{fetchError}</div>
              <button onClick={load} className="px-6 py-2.5 text-sm font-medium rounded-full border border-[#ffffff1a] bg-[#161c24] text-[#f0f4f8] hover:border-[#e6b95c]/50 hover:text-[#e6b95c] transition-colors">{t("costs.retry")}</button>
            </div>
          ) : viewState === "empty" ? (
            <div className="p-12 text-center text-[#64748b] bg-[#161c24]/30">{t("costs.empty")}</div>
          ) : rows.map(r => {
            const isEditing = editing === r.identityKey;
            return (
              <div key={r.primaryProductId || r.identityKey} className="p-5 flex flex-col gap-5 hover:bg-[#161c24]/50 transition-colors">
                <div>
                  <div className="font-semibold text-[#f0f4f8] text-base leading-tight mb-1">{r.name}</div>
                  <div className="text-xs text-[#64748b] font-mono">{r.sku || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm bg-[#161c24] p-4 rounded-xl border border-[#ffffff1a]">
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">{t("costs.table.price")}</div>
                    <div className="text-[#f0f4f8] font-medium">{halalaToSar(r.latestPriceHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">{t("costs.table.totalCost")}</div>
                    <div className="text-[#f0f4f8] font-medium">{halalaToSar(r.computed.totalCostHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">{t("costs.table.netProfit")}</div>
                    <div className="font-medium text-[#0fc9a7]">{halalaToSar(r.computed.profitHalala)} {currency}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">{t("costs.table.margin")}</div>
                    <div className="text-[#f0f4f8] font-medium">{r.computed.marginPercent == null ? "—" : `${r.computed.marginPercent}%`}</div>
                  </div>
                </div>

                {!isEditing && (
                  <button onClick={() => onEdit(r)} className="self-start px-6 py-2 text-sm font-medium rounded-full bg-[#161c24] border border-[#ffffff1a] text-[#f0f4f8] hover:border-[#e6b95c]/50 hover:text-[#e6b95c] transition-colors">
                    {t("costs.table.edit")}
                  </button>
                )}

                {isEditing && (
                  <div className="mt-2 w-full">
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
