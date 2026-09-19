'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { ReportComparisonDetails } from "@/components/dashboard/report-comparison";
import type { ReportComparison } from "@/lib/reports/comparison-format";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { Skeleton } from "@/components/dashboard/skeleton";

export type Snap = {
  id: string;
  createdAt: number;
  timeRangeStart: number;
  timeRangeEnd: number;
  grossSales: number;
  totalProfit: number;
  marginPct: number;
  ordersCount: number;
  reportId?: string;
};

export function ReportsClient({
  isFree,
  previewProps
}: {
  isFree: boolean;
  previewProps?: {
    rows?: Snap[];
    loadState?: 'populated' | 'loading' | 'empty' | 'error';
    compare?: ReportComparison | null;
    compareLoadState?: 'populated' | 'loading' | 'error';
    showComparisonForId?: string;
    actionHref?: string;
  };
}) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const isPreview = !!previewProps;

  const [rows, setRows] = useState<Snap[]>(isPreview ? (previewProps.rows || []) : []);
  const [loading, setLoading] = useState(isPreview ? previewProps.loadState === 'loading' : true);
  const [activeCompareId, setActiveCompareId] = useState<string | null>(isPreview ? (previewProps.showComparisonForId || null) : null);
  const [compare, setCompare] = useState<ReportComparison | null>(isPreview ? (previewProps.compare || null) : null);
  const [loadingCompareId, setLoadingCompareId] = useState<string | null>(
    isPreview && previewProps.compareLoadState === 'loading' && previewProps.showComparisonForId
      ? previewProps.showComparisonForId
      : null
  );
  const [loadError, setLoadError] = useState(isPreview ? previewProps.loadState === 'error' : false);
  const [compareErrorId, setCompareErrorId] = useState<string | null>(
    isPreview && previewProps.compareLoadState === 'error' && previewProps.showComparisonForId
      ? previewProps.showComparisonForId
      : null
  );
  const compareGenerationRef = useRef(0);
  const compareAbortControllerRef = useRef<AbortController | null>(null);
  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const currency = t("common.currency.short");

  const loadReports = async () => {
    if (isPreview) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/reports?range=weekly&limit=12', { cache: 'no-store' });
      if (!res.ok) throw new Error("Unable to load reports");
      const data: unknown = await res.json();
      const nestedSnapshots =
        data && typeof data === "object" && "snapshots" in data
          ? (data as { snapshots?: unknown }).snapshots
          : undefined;
      const snapshots = Array.isArray(data)
        ? data
        : Array.isArray(nestedSnapshots)
          ? nestedSnapshots
          : [];
      setRows(snapshots as Snap[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPreview) {
      const timeoutId = window.setTimeout(() => {
        if (previewProps?.rows) setRows(previewProps.rows);
        if (previewProps?.loadState) {
          setLoading(previewProps.loadState === 'loading');
          setLoadError(previewProps.loadState === 'error');
        }
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Initial production request only. Preview changes are synchronized above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, previewProps]);

  useEffect(() => {
    return () => compareAbortControllerRef.current?.abort();
  }, []);

  const handleCompare = async (id: string) => {
    if (loadingCompareId === id) return;

    if (isPreview) {
      const isOpen = activeCompareId === id;
      if (isOpen) {
        setActiveCompareId(null);
      } else {
        setActiveCompareId(id);
        setLoadingCompareId(previewProps?.compareLoadState === 'loading' ? id : null);
        setCompare(previewProps?.compare || null);
        setCompareErrorId(previewProps?.compareLoadState === 'error' ? id : null);
      }
      return;
    }

    if (activeCompareId === id) {
      setActiveCompareId(null);
      return;
    }

    compareAbortControllerRef.current?.abort();
    const controller = new AbortController();
    compareAbortControllerRef.current = controller;
    const requestGeneration = ++compareGenerationRef.current;
    setLoadingCompareId(id);
    setActiveCompareId(id);
    setCompare(null);
    setCompareErrorId(null);
    try {
      const res = await fetch(
        `/api/reports/compare?current=${encodeURIComponent(id)}&previous=auto`,
        { cache: 'no-store', signal: controller.signal },
      );
      if (!res.ok) throw new Error("Unable to compare reports");
      const data = await res.json();
      if (requestGeneration !== compareGenerationRef.current) return;
      setCompare(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestGeneration !== compareGenerationRef.current) return;
      setCompareErrorId(id);
    } finally {
      if (requestGeneration === compareGenerationRef.current) {
        compareAbortControllerRef.current = null;
        setLoadingCompareId(null);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto text-[#f0f4f8]">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-[#f0f4f8]">{t("reports.title")}</h1>
        </div>
        <div className="bg-[#0e1218] p-6 sm:p-8 rounded-3xl border border-[#ffffff1a] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="text-lg font-semibold text-[#f0f4f8]">{t("reports.weeklySummaries")}</div>
            {isFree && <Link href={isPreview && previewProps?.actionHref ? previewProps.actionHref : "/pricing"} className="text-sm font-medium text-[#e6b95c] hover:text-[#f9d889] transition-colors px-4 py-2 rounded-full border border-[#e6b95c]/30 hover:bg-[#e6b95c]/10">{t("reports.upgrade")}</Link>}
          </div>
          {isFree ? (
            <div className="relative">
              <div className="opacity-20 select-none pointer-events-none filter blur-[2px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-5 rounded-2xl border border-[#ffffff1a] bg-[#161c24]">
                      <div className="text-xs text-[#94a3b8]">{t("reports.lock.week")}</div>
                      <div className="text-base font-medium text-[#f0f4f8] mt-1 mb-2">—</div>
                      <div className="text-xs text-[#64748b]">{t("reports.lock.metrics")}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-sm font-bold bg-[#161c24]/90 backdrop-blur-md border border-[#e6b95c]/30 text-[#e6b95c] rounded-full px-6 py-3 shadow-[0_0_20px_rgba(230,185,92,0.15)]">
                  {t("reports.lock.message")}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label={t("reports.loading")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-2xl bg-[#161c24]" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-6 text-center">
              <p className="text-sm font-medium text-[#ef4444] mb-4">{t("reports.error")}</p>
              <button
                type="button"
                onClick={loadReports}
                className="min-h-11 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-6 py-2 text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/20 transition-transform active:scale-95"
              >
                {t("reports.retry")}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#64748b] bg-[#161c24]/50 rounded-2xl border border-[#ffffff1a] border-dashed">{t("reports.empty")}</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-start text-sm border-collapse">
                  <thead className="bg-[#161c24] text-[#94a3b8] border-b border-[#ffffff1a]">
                    <tr>
                      <th className="px-5 py-4 font-semibold text-start rounded-tl-xl">{t("reports.table.week")}</th>
                      <th className="px-5 py-4 font-semibold text-start">{t("reports.table.sales")}</th>
                      <th className="px-5 py-4 font-semibold text-start">{t("reports.table.profit")}</th>
                      <th className="px-5 py-4 font-semibold text-start">{t("reports.table.margin")}</th>
                      <th className="px-5 py-4 font-semibold text-start">{t("reports.table.orders")}</th>
                      <th className="px-5 py-4 font-semibold text-start">{t("reports.table.report")}</th>
                      <th className="px-5 py-4 font-semibold text-start rounded-tr-xl">{t("reports.table.compare")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ffffff1a]">
                    {rows.map((r) => {
                      const isOpen = activeCompareId === r.id && (compare || compareErrorId === r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={`hover:bg-[#161c24]/50 transition-colors group ${isOpen ? 'bg-[#161c24]/30' : ''}`}>
                            <td className="px-5 py-5 text-xs text-[#94a3b8] whitespace-nowrap">
                              {new Date(r.timeRangeStart).toLocaleDateString(locale)} — {new Date(r.timeRangeEnd).toLocaleDateString(locale)}
                            </td>
                            <td className="px-5 py-5 font-bold text-white whitespace-nowrap">
                              <AnimatedNumber value={r.grossSales || 0} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} />
                            </td>
                            <td className="px-5 py-5 text-[#0fc9a7] font-bold whitespace-nowrap">
                              <AnimatedNumber value={r.totalProfit || 0} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} />
                            </td>
                            <td className="px-5 py-5 text-white font-medium whitespace-nowrap">
                              <AnimatedNumber value={r.marginPct || 0} formatter={(v) => `${v.toFixed(2)}%`} />
                            </td>
                            <td className="px-5 py-5 text-white font-medium whitespace-nowrap">
                              <AnimatedNumber value={r.ordersCount || 0} />
                            </td>
                            <td className="px-5 py-5 whitespace-nowrap">
                              {r.reportId ? (
                                <Link
                                  href={isPreview && previewProps?.actionHref ? previewProps.actionHref : `/dashboard?reportId=${encodeURIComponent(r.reportId)}`}
                                  className="inline-flex items-center justify-center text-xs font-bold text-[#0fc9a7] bg-[#0fc9a7]/10 border border-[#0fc9a7]/20 rounded-full px-4 py-1.5 hover:bg-[#0fc9a7]/20 transition-transform hover:scale-105 active:scale-95"
                                >
                                  {t("reports.openReport")}
                                </Link>
                              ) : (
                                <span className="text-xs text-[#64748b] bg-[#161c24] px-3 py-1.5 rounded-full border border-[#ffffff1a]">{t("reports.notAvailable")}</span>
                              )}
                            </td>
                            <td className="px-5 py-5 whitespace-nowrap">
                              <button
                                className={`min-h-9 rounded-full border px-4 py-1.5 text-xs font-bold transition-all focus:opacity-100 ${
                                  isOpen
                                    ? 'bg-[#e6b95c]/10 text-[#e6b95c] border-[#e6b95c]/30 opacity-100'
                                    : 'bg-[#161c24] text-white border-[#ffffff1a] hover:border-[#e6b95c]/50 hover:text-[#e6b95c] opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                                }`}
                                onClick={() => handleCompare(r.id)}
                                aria-expanded={Boolean(isOpen)}
                              >
                                {loadingCompareId === r.id
                                  ? t("reports.compare.loading")
                                  : isOpen ? t("reports.compare.button") + " ↑" : t("reports.compare.button")}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={7} className="p-0 border-b border-[#ffffff1a]">
                                <div className="bg-[#0b0e12] border-t border-[#ffffff1a] p-6 sm:p-8 text-sm text-[#f0f4f8] shadow-inner">
                                  {compareErrorId === r.id ? (
                                    <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-4 text-sm text-[#ef4444] font-medium">
                                      {t("reports.compare.error")}
                                    </div>
                                  ) : compare?.previous ? (
                                    <ReportComparisonDetails comparison={compare} />
                                  ) : (
                                    <div className="text-center text-[#94a3b8] py-8 border border-dashed border-[#ffffff1a] rounded-xl">{t("reports.compare.noPrevious")}</div>
                                  )}
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

              {/* Mobile View */}
              <div className="flex flex-col gap-4 md:hidden">
                {rows.map((r) => {
                  const isOpen = activeCompareId === r.id && (compare || compareErrorId === r.id);
                  return (
                    <div key={r.id} className={`bg-[#0e1218] border border-[#ffffff1a] rounded-3xl p-5 shadow-sm transition-all ${isOpen ? 'ring-1 ring-[#e6b95c]/30' : ''}`}>
                      <div className="text-xs text-[#94a3b8] mb-4">
                        {new Date(r.timeRangeStart).toLocaleDateString(locale)} — {new Date(r.timeRangeEnd).toLocaleDateString(locale)}
                      </div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm mb-6 bg-[#161c24] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div>
                          <div className="text-[#94a3b8] text-xs mb-1">{t("reports.table.sales")}</div>
                          <div className="font-bold text-white">
                            <AnimatedNumber value={r.grossSales || 0} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8] text-xs mb-1">{t("reports.table.profit")}</div>
                          <div className="font-bold text-[#0fc9a7]">
                            <AnimatedNumber value={r.totalProfit || 0} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8] text-xs mb-1">{t("reports.table.margin")}</div>
                          <div className="font-medium text-white">
                            <AnimatedNumber value={r.marginPct || 0} formatter={(v) => `${v.toFixed(2)}%`} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[#94a3b8] text-xs mb-1">{t("reports.table.orders")}</div>
                          <div className="font-medium text-white">
                            <AnimatedNumber value={r.ordersCount || 0} />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {r.reportId ? (
                          <Link
                            href={isPreview && previewProps?.actionHref ? previewProps.actionHref : `/dashboard?reportId=${encodeURIComponent(r.reportId)}`}
                            className="flex-1 flex items-center justify-center text-xs font-bold text-[#0fc9a7] bg-[#0fc9a7]/10 border border-[#0fc9a7]/20 rounded-full px-4 py-3 hover:bg-[#0fc9a7]/20 transition-transform hover:scale-105 active:scale-95"
                          >
                            {t("reports.openReport")}
                          </Link>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-xs text-[#64748b] border border-[#ffffff1a] rounded-full px-4 py-3 bg-[#161c24]">
                            {t("reports.notAvailable")}
                          </div>
                        )}
                        <button
                          className={`min-h-11 flex-1 flex items-center justify-center rounded-full border px-4 py-3 text-xs font-bold transition-all active:scale-95 ${
                            isOpen
                              ? 'bg-[#e6b95c]/10 text-[#e6b95c] border-[#e6b95c]/30'
                              : 'bg-[#161c24] text-white border-[#ffffff1a] hover:border-[#e6b95c]/50 hover:text-[#e6b95c]'
                          }`}
                          onClick={() => handleCompare(r.id)}
                          aria-expanded={Boolean(isOpen)}
                        >
                          {loadingCompareId === r.id
                            ? t("reports.compare.loading")
                            : isOpen ? t("reports.compare.button") + " ↑" : t("reports.compare.button")}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-5 pt-5 border-t border-[#ffffff1a] bg-[#0b0e12] -mx-5 -mb-5 p-5 rounded-b-3xl shadow-inner">
                          {compareErrorId === r.id ? (
                            <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-4 text-center text-sm font-medium text-[#ef4444]">
                              {t("reports.compare.error")}
                            </div>
                          ) : compare?.previous ? (
                            <ReportComparisonDetails comparison={compare} />
                          ) : (
                            <div className="text-center text-[#94a3b8] py-6 border border-dashed border-[#ffffff1a] rounded-xl text-sm">{t("reports.compare.noPrevious")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
    </div>
  );
}