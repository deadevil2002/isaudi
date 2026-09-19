'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { ReportComparisonDetails } from "@/components/dashboard/report-comparison";
import type { ReportComparison } from "@/lib/reports/comparison-format";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { Skeleton } from "@/components/dashboard/skeleton";
import { PieChart, Lock } from "lucide-react";

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
  const hasAutoSelected = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const currency = t("common.currency.short") || (lang === "ar" ? "ر.س." : "SAR");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, previewProps]);

  useEffect(() => {
    return () => compareAbortControllerRef.current?.abort();
  }, []);

  const handleCompare = useCallback(async (id: string) => {
    if (loadingCompareId === id) return;

    if (isPreview) {
      if (activeCompareId === id) return;
      setActiveCompareId(id);
      setLoadingCompareId(previewProps?.compareLoadState === 'loading' ? id : null);
      setCompare(previewProps?.compare || null);
      setCompareErrorId(previewProps?.compareLoadState === 'error' ? id : null);
      return;
    }

    if (activeCompareId === id) return;

    compareAbortControllerRef.current?.abort();
    const controller = new AbortController();
    compareAbortControllerRef.current = controller;
    const requestGeneration = ++compareGenerationRef.current;
    setLoadingCompareId(id);
    setActiveCompareId(id);
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
  }, [activeCompareId, isPreview, loadingCompareId, previewProps]);

  useEffect(() => {
    if (!isPreview && rows.length > 0 && !hasAutoSelected.current && !loading && !loadError) {
      hasAutoSelected.current = true;
      void handleCompare(rows[0].id);
    }
  }, [handleCompare, rows, isPreview, loading, loadError]);

  const formatDateRange = (start: number, end: number) => {
    const s = new Date(start).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${s} — ${e}`;
  };

  const selectedSnap = rows.find((r) => r.id === activeCompareId);

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 text-[#f0f4f8] h-full flex flex-col py-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("reports.title")}</h1>
          <p className="text-sm text-[#94a3b8] mt-1">{t("reports.weeklySummaries")}</p>
        </div>
        {isFree && (
          <Link href={isPreview && previewProps?.actionHref ? previewProps.actionHref : "/pricing"} className="inline-flex px-5 py-2.5 rounded-full border border-[#e6b95c]/30 text-[#e6b95c] hover:bg-[#e6b95c]/10 transition-colors font-medium text-sm w-fit active:scale-95">
            {t("reports.upgrade")}
          </Link>
        )}
      </div>

      {isFree ? (
        <div className="relative rounded-3xl overflow-hidden border border-[#ffffff1a] bg-[#0e1218]">
          <div className="opacity-20 select-none pointer-events-none filter blur-[4px] p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <div className="w-full lg:w-[380px] flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[140px] bg-[#161c24] rounded-2xl border border-[#ffffff1a]" />
                ))}
              </div>
              <div className="hidden lg:block lg:flex-1 h-[600px] bg-[#161c24] rounded-3xl border border-[#ffffff1a]" />
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/40">
            <div className="text-center max-w-md w-full px-8 py-10 bg-[#0b0e12]/95 backdrop-blur-2xl border border-[#e6b95c]/30 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5),0_0_30px_rgba(230,185,92,0.15)]">
              <div className="w-16 h-16 rounded-full bg-[#e6b95c]/10 text-[#e6b95c] flex items-center justify-center mx-auto mb-6 shadow-inner border border-[#e6b95c]/20">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t("reports.lock.message")}</h3>
              <p className="text-[#94a3b8] mb-8 leading-relaxed">{t("reports.workspace.lockDescription")}</p>
              <Link
                href={isPreview && previewProps?.actionHref ? previewProps.actionHref : "/pricing"}
                className="inline-flex w-full items-center justify-center py-3.5 rounded-full bg-[#e6b95c] text-black text-sm font-bold hover:bg-[#f9d889] transition-transform active:scale-95 shadow-[0_0_15px_rgba(230,185,92,0.3)]"
              >
                {t("reports.upgrade")}
              </Link>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          <div className="w-full lg:w-[380px] shrink-0 flex gap-4 overflow-x-auto lg:overflow-x-hidden lg:flex-col lg:gap-4 hide-scrollbar">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="min-w-[280px] lg:min-w-0 h-[140px] rounded-2xl bg-[#161c24] shrink-0" />
            ))}
          </div>
          <div className="w-full lg:flex-1">
            <Skeleton className="w-full h-[500px] rounded-3xl bg-[#161c24]" />
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-3xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-12 text-center">
          <p className="text-lg font-medium text-[#ef4444] mb-6">{t("reports.error")}</p>
          <button
            type="button"
            onClick={loadReports}
            className="min-h-12 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-8 py-3 text-sm font-bold text-[#ef4444] hover:bg-[#ef4444]/20 transition-transform active:scale-95"
          >
            {t("reports.retry")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#0e1218] border border-dashed border-[#ffffff1a] rounded-3xl">
          <PieChart className="w-16 h-16 text-[#64748b] mb-6 opacity-50" />
          <p className="text-xl font-medium text-white mb-2">{t("reports.empty")}</p>
          <p className="text-sm text-[#94a3b8] max-w-sm text-center">{t("reports.workspace.emptyDescription")}</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative">
          {/* Master List */}
          <div className="w-full lg:w-[380px] shrink-0 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 lg:pb-0 lg:flex-col lg:gap-4 lg:h-[calc(100vh-180px)] lg:overflow-x-hidden lg:overflow-y-auto lg:snap-none hide-scrollbar lg:pe-2">
            {rows.map((r) => {
              const isSelected = activeCompareId === r.id;

              return (
                <div key={r.id} className="snap-start snap-always min-w-[280px] lg:min-w-0">
                  <button
                    onClick={() => {
                      handleCompare(r.id);
                      if (window.innerWidth < 1024 && scrollRef.current) {
                        scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }}
                    className={`w-full text-start p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col gap-4 ${
                      isSelected
                        ? 'bg-[#161c24] border-[#0fc9a7]/40 shadow-[0_4px_20px_rgba(15,201,167,0.1)] ring-1 ring-[#0fc9a7]/20'
                        : 'bg-[#0e1218] border-[#ffffff1a] hover:border-[#ffffff33] hover:bg-[#161c24]/50'
                    }`}
                    aria-expanded={isSelected}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="selected-report-indicator"
                        transition={reducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute start-0 top-0 w-full h-1 lg:w-1 lg:h-full bg-[#0fc9a7] shadow-[0_0_10px_rgba(15,201,167,0.5)]"
                      />
                    )}

                    <div className="flex justify-between items-start w-full">
                      <div>
                        <div className="text-sm font-bold text-white mb-0.5">{formatDateRange(r.timeRangeStart, r.timeRangeEnd)}</div>
                        <div className="text-[11px] text-[#64748b]">{new Date(r.timeRangeStart).getFullYear()}</div>
                      </div>
                      {r.reportId ? (
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20 shadow-sm" title={t("reports.table.report")}>
                          <PieChart className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#161c24] text-[#64748b] border border-[#ffffff1a]" title={t("reports.notAvailable")}>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div>
                        <div className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wider mb-1">{t("reports.table.sales")}</div>
                        <div className="text-sm font-bold text-white flex items-baseline">
                          <AnimatedNumber value={r.grossSales} formatter={(v) => `${v.toLocaleString(locale)}`} />
                          <span className="text-[10px] text-[#64748b] ms-1">{currency}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wider mb-1">{t("reports.table.profit")}</div>
                        <div className="text-sm font-bold text-[#0fc9a7] flex items-baseline">
                          <AnimatedNumber value={r.totalProfit} formatter={(v) => `${v.toLocaleString(locale)}`} />
                          <span className="text-[10px] text-[#0fc9a7]/70 ms-1">{currency}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Detail View */}
          <div ref={scrollRef} className="w-full lg:flex-1 min-w-0 lg:sticky lg:top-6 flex flex-col gap-6">
            {selectedSnap ? (
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={selectedSnap.id}
                  initial={reducedMotion ? false : { opacity: 0.82, x: lang === "ar" ? -12 : 12, scale: 0.995 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0.72, x: lang === "ar" ? 8 : -8, scale: 0.995 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-[#0e1218] border border-[#ffffff1a] rounded-3xl p-6 lg:p-8 shadow-depth flex flex-col relative overflow-hidden group"
                >
                  <div className="absolute top-0 end-0 w-64 h-64 bg-[#0fc9a7]/5 rounded-full blur-[80px] pointer-events-none transition-opacity duration-1000" />

                  <div className="relative z-10 flex flex-col gap-8">
                  {/* Detail Header */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold tracking-widest uppercase text-[#0fc9a7]">{t("reports.workspace.weeklyReview")}</span>
                      </div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-white">
                        {formatDateRange(selectedSnap.timeRangeStart, selectedSnap.timeRangeEnd)}
                      </h2>
                      <div className="text-sm text-[#94a3b8] mt-1">{new Date(selectedSnap.timeRangeStart).getFullYear()}</div>
                    </div>

                    {selectedSnap.reportId ? (
                      <Link
                        href={isPreview && previewProps?.actionHref ? previewProps.actionHref : `/dashboard?reportId=${encodeURIComponent(selectedSnap.reportId)}`}
                        className="inline-flex items-center justify-center px-6 py-3 bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20 text-sm font-bold rounded-full hover:bg-[#0fc9a7]/20 transition-all shadow-sm active:scale-95 shrink-0"
                      >
                        <PieChart className="w-4 h-4 me-2" />
                        {t("reports.openReport")}
                      </Link>
                    ) : (
                      <div className="inline-flex items-center justify-center px-6 py-3 bg-[#161c24] text-[#64748b] border border-[#ffffff1a] text-sm font-bold rounded-full cursor-not-allowed shrink-0">
                        {t("reports.notAvailable")}
                      </div>
                    )}
                  </div>

                  {/* Comparison Module */}
                  <div
                    className="bg-[#161c24] rounded-2xl border border-[#ffffff1a] p-1 shadow-inner overflow-hidden"
                    aria-busy={loadingCompareId === activeCompareId}
                  >
                    <div className={`transition-all duration-700 ease-in-out ${loadingCompareId === activeCompareId ? 'opacity-40 scale-[0.99] filter blur-[1px]' : 'opacity-100 scale-100 filter-none'}`}>
                      {compareErrorId === activeCompareId ? (
                        <div className="p-8 text-center text-[#ef4444] bg-[#ef4444]/10 rounded-xl border border-[#ef4444]/20 font-medium m-1">
                          {t("reports.compare.error")}
                        </div>
                      ) : compare?.previous ? (
                        <div className="bg-[#0b0e12] rounded-xl border border-[#ffffff1a] p-5 lg:p-6 shadow-sm">
                          <ReportComparisonDetails comparison={compare} />
                        </div>
                      ) : (
                        <div className="bg-[#0b0e12] rounded-xl border border-[#ffffff1a] p-5 lg:p-6 shadow-sm m-1">
                          <div className="mb-6 flex items-center justify-between">
                            <div className="text-sm font-bold text-white">{t("reports.workspace.kpis")}</div>
                            <div className="text-xs text-[#94a3b8] px-3 py-1.5 bg-[#161c24] rounded-md border border-[#ffffff1a]">{t("reports.compare.noPrevious")}</div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-[#161c24] p-5 rounded-xl border border-[#ffffff1a]">
                              <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.sales")}</div>
                              <div className="text-xl font-bold text-white"><AnimatedNumber value={selectedSnap.grossSales} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} /></div>
                            </div>
                            <div className="bg-[#161c24] p-5 rounded-xl border border-[#ffffff1a]">
                              <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.profit")}</div>
                              <div className="text-xl font-bold text-[#0fc9a7]"><AnimatedNumber value={selectedSnap.totalProfit} formatter={(v) => `${v.toLocaleString(locale)} ${currency}`} /></div>
                            </div>
                            <div className="bg-[#161c24] p-5 rounded-xl border border-[#ffffff1a]">
                              <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.margin")}</div>
                              <div className="text-xl font-bold text-white"><AnimatedNumber value={selectedSnap.marginPct} formatter={(v) => `${v.toFixed(2)}%`} /></div>
                            </div>
                            <div className="bg-[#161c24] p-5 rounded-xl border border-[#ffffff1a]">
                              <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.orders")}</div>
                              <div className="text-xl font-bold text-white"><AnimatedNumber value={selectedSnap.ordersCount} /></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="bg-[#0e1218] border border-[#ffffff1a] rounded-3xl p-8 flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-[#64748b] max-w-sm">
                  <PieChart className="w-16 h-16 mx-auto mb-6 opacity-30" />
                  <p className="text-xl font-medium text-[#94a3b8] mb-3">{t("reports.workspace.selectTitle")}</p>
                  <p className="text-sm leading-relaxed">{t("reports.workspace.selectDescription")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
