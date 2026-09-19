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
import { PieChart, Lock, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    compareExpanded?: boolean;
    selectionHrefBase?: string;
    actionHref?: string;
  };
}) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const isPreview = !!previewProps;

  const [rows, setRows] = useState<Snap[]>(isPreview ? (previewProps.rows || []) : []);
  const [loading, setLoading] = useState(isPreview ? previewProps.loadState === 'loading' : true);

  const [selectedId, setSelectedId] = useState<string | null>(isPreview ? (previewProps.showComparisonForId || null) : null);
  const [isCompareExpanded, setIsCompareExpanded] = useState(isPreview ? previewProps.compareExpanded === true : false);

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
  const railRef = useRef<HTMLDivElement>(null);
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
      setLoadingCompareId(previewProps?.compareLoadState === 'loading' ? id : null);
      setCompare(previewProps?.compare || null);
      setCompareErrorId(previewProps?.compareLoadState === 'error' ? id : null);
      return;
    }

    compareAbortControllerRef.current?.abort();
    const controller = new AbortController();
    compareAbortControllerRef.current = controller;
    const requestGeneration = ++compareGenerationRef.current;

    setLoadingCompareId(id);
    setCompareErrorId(null);
    setCompare(null);

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
  }, [isPreview, loadingCompareId, previewProps]);

  const formatDateRange = (start: number, end: number) => {
    const s = new Date(start).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${s} — ${e}`;
  };

  const handleScrollNext = () => {
    if (railRef.current) {
      const amount = railRef.current.clientWidth * 0.75;
      railRef.current.scrollBy({ left: lang === 'ar' ? -amount : amount, behavior: 'smooth' });
    }
  };

  const handleScrollPrev = () => {
    if (railRef.current) {
      const amount = railRef.current.clientWidth * 0.75;
      railRef.current.scrollBy({ left: lang === 'ar' ? amount : -amount, behavior: 'smooth' });
    }
  };

  const effectiveSelectedId = selectedId ?? rows[0]?.id ?? null;
  const selectedSnap = rows.find((r) => r.id === effectiveSelectedId);
  const selectedIndex = rows.findIndex((r) => r.id === effectiveSelectedId);
  const hasPreviousComparable = selectedIndex >= 0 && selectedIndex < rows.length - 1;
  const previewReportHref = (reportId: string, comparison: "open" | "closed") => {
    const base = previewProps?.selectionHrefBase || "/design-preview/dashboard-review?section=reports";
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}selectedReport=${encodeURIComponent(reportId)}&comparison=${comparison}#qa-shell-content`;
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 text-[#f0f4f8] h-full flex flex-col py-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("reports.title")}</h1>
          <p className="text-sm text-[#94a3b8] mt-1">{t("reports.weeklySummaries")}</p>
        </div>
        <div className="flex items-center gap-4">
          {isFree && (
            <Link href={isPreview && previewProps?.actionHref ? previewProps.actionHref : "/pricing"} className="inline-flex px-5 py-2.5 rounded-full border border-[#e6b95c]/30 text-[#e6b95c] hover:bg-[#e6b95c]/10 transition-colors font-medium text-sm w-fit active:scale-95">
              {t("reports.upgrade")}
            </Link>
          )}

          {!isFree && !loading && !loadError && rows.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              {isPreview ? (
                <>
                  <a
                    href="#report-card-0"
                    className="w-10 h-10 rounded-full bg-[#161c24] border border-[#ffffff1a] flex items-center justify-center text-white hover:bg-[#ffffff1a] transition-colors active:scale-95"
                    aria-label={t("reports.history.previous")}
                  >
                    <ChevronLeft className={cn("w-5 h-5", lang === 'ar' && "rotate-180")} />
                  </a>
                  <a
                    href={`#report-card-${rows.length - 1}`}
                    className="w-10 h-10 rounded-full bg-[#161c24] border border-[#ffffff1a] flex items-center justify-center text-white hover:bg-[#ffffff1a] transition-colors active:scale-95"
                    aria-label={t("reports.history.next")}
                  >
                    <ChevronRight className={cn("w-5 h-5", lang === 'ar' && "rotate-180")} />
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleScrollPrev}
                    className="w-10 h-10 rounded-full bg-[#161c24] border border-[#ffffff1a] flex items-center justify-center text-white hover:bg-[#ffffff1a] transition-colors active:scale-95"
                    aria-label={t("reports.history.previous")}
                  >
                    <ChevronLeft className={cn("w-5 h-5", lang === 'ar' && "rotate-180")} />
                  </button>
                  <button
                    type="button"
                    onClick={handleScrollNext}
                    className="w-10 h-10 rounded-full bg-[#161c24] border border-[#ffffff1a] flex items-center justify-center text-white hover:bg-[#ffffff1a] transition-colors active:scale-95"
                    aria-label={t("reports.history.next")}
                  >
                    <ChevronRight className={cn("w-5 h-5", lang === 'ar' && "rotate-180")} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isFree ? (
        <div className="relative rounded-3xl overflow-hidden border border-[#ffffff1a] bg-[#0e1218]">
          <div className="opacity-20 select-none pointer-events-none filter blur-[4px] p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:gap-8">
              <div className="w-full flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[140px] min-w-[280px] bg-[#161c24] rounded-2xl border border-[#ffffff1a]" />
                ))}
              </div>
              <div className="hidden lg:block w-full h-[400px] bg-[#161c24] rounded-3xl border border-[#ffffff1a]" />
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
        <div className="flex flex-col gap-6 lg:gap-8 w-full">
          <div className="w-full flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="min-w-[280px] h-[140px] rounded-2xl bg-[#161c24] shrink-0" />
            ))}
          </div>
          <div className="w-full">
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
        <div className="flex flex-col gap-6 lg:gap-8 w-full">
          {/* Horizontal Rail */}
          <div className="w-full relative">
            <div
              ref={railRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {rows.map((r, index) => {
                const isSelected = effectiveSelectedId === r.id;
                const cardClassName = `w-full text-start p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col gap-4 ${
                  isSelected
                    ? 'bg-[#161c24] border-[#0fc9a7]/40 shadow-[0_4px_20px_rgba(15,201,167,0.1)] ring-1 ring-[#0fc9a7]/20'
                    : 'bg-[#0e1218] border-[#ffffff1a] hover:border-[#ffffff33] hover:bg-[#161c24]/50'
                }`;
                const cardContent = (
                  <>
                    {isSelected && (
                      <motion.div
                        layoutId="selected-report-indicator"
                        transition={reducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute start-0 top-0 w-full h-1 bg-[#0fc9a7] shadow-[0_0_10px_rgba(15,201,167,0.5)]"
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
                  </>
                );

                return (
                  <div id={`report-card-${index}`} key={r.id} className="scroll-m-4 snap-start snap-always w-[280px] sm:w-[320px] lg:w-[340px] shrink-0">
                    {isPreview ? (
                      <Link
                        href={previewReportHref(r.id, "closed")}
                        className={cardClassName}
                        aria-current={isSelected ? "true" : undefined}
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          if (r.id !== effectiveSelectedId) {
                            compareAbortControllerRef.current?.abort();
                            compareAbortControllerRef.current = null;
                            compareGenerationRef.current += 1;
                            setSelectedId(r.id);
                            setIsCompareExpanded(false);
                            setLoadingCompareId(null);
                            setCompareErrorId(null);
                            setCompare(null);
                            event.currentTarget.parentElement?.scrollIntoView({
                              behavior: reducedMotion ? "auto" : "smooth",
                              block: "nearest",
                              inline: "nearest",
                            });
                          }
                        }}
                        className={cardClassName}
                        aria-pressed={isSelected}
                      >
                        {cardContent}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Width Detail View */}
          <div className="w-full flex flex-col gap-6">
            {selectedSnap ? (
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={selectedSnap.id}
                  initial={reducedMotion ? false : { opacity: 0.82, y: 12, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0.72, y: -8, scale: 0.995 }}
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

                    {/* KPIs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-[#161c24] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.sales")}</div>
                        <div className="text-2xl font-bold text-white flex items-baseline">
                          <AnimatedNumber value={selectedSnap.grossSales} formatter={(v) => `${v.toLocaleString(locale)}`} />
                          <span className="text-sm text-[#64748b] ms-1.5">{currency}</span>
                        </div>
                      </div>
                      <div className="bg-[#161c24] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.profit")}</div>
                        <div className="text-2xl font-bold text-[#0fc9a7] flex items-baseline">
                          <AnimatedNumber value={selectedSnap.totalProfit} formatter={(v) => `${v.toLocaleString(locale)}`} />
                          <span className="text-sm text-[#0fc9a7]/70 ms-1.5">{currency}</span>
                        </div>
                      </div>
                      <div className="bg-[#161c24] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.margin")}</div>
                        <div className="text-2xl font-bold text-white"><AnimatedNumber value={selectedSnap.marginPct} formatter={(v) => `${v.toFixed(2)}%`} /></div>
                      </div>
                      <div className="bg-[#161c24] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="text-[11px] font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">{t("reports.table.orders")}</div>
                        <div className="text-2xl font-bold text-white"><AnimatedNumber value={selectedSnap.ordersCount} /></div>
                      </div>
                    </div>

                    {/* Compare Action */}
                    <div className="mt-2 border-t border-[#ffffff1a] pt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-white">{t("reports.table.compare")}</h3>
                        {hasPreviousComparable ? (
                          isPreview ? (
                            <Link
                              href={previewReportHref(selectedSnap.id, isCompareExpanded ? "closed" : "open")}
                              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#161c24] border border-[#ffffff1a] hover:bg-[#ffffff1a] transition-colors rounded-full text-sm font-medium text-white shadow-sm active:scale-95"
                              aria-expanded={isCompareExpanded}
                              aria-controls="report-comparison-workspace"
                            >
                              {t("reports.compare.button")}
                              <ChevronDown className={cn("w-4 h-4 ms-2 transition-transform", isCompareExpanded && "rotate-180")} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const willExpand = !isCompareExpanded;
                                setIsCompareExpanded(willExpand);
                                if (willExpand) {
                                  void handleCompare(selectedSnap.id);
                                }
                              }}
                              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#161c24] border border-[#ffffff1a] hover:bg-[#ffffff1a] transition-colors rounded-full text-sm font-medium text-white shadow-sm active:scale-95"
                              aria-expanded={isCompareExpanded}
                              aria-controls="report-comparison-workspace"
                            >
                              {t("reports.compare.button")}
                              <ChevronDown className={cn("w-4 h-4 ms-2 transition-transform", isCompareExpanded && "rotate-180")} />
                            </button>
                          )
                        ) : (
                          <span className="text-sm text-[#94a3b8]">{t("reports.compare.noPrevious")}</span>
                        )}
                      </div>

                      <AnimatePresence>
                        {hasPreviousComparable && isCompareExpanded && (
                          <motion.div
                            id="report-comparison-workspace"
                            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="bg-[#161c24] rounded-2xl border border-[#ffffff1a] p-1 shadow-inner overflow-hidden mb-2">
                               <div className={`transition-all duration-700 ease-in-out ${loadingCompareId === effectiveSelectedId && !compare ? 'opacity-40 scale-[0.99] filter blur-[1px]' : 'opacity-100 scale-100 filter-none'}`}>
                                 {compareErrorId === effectiveSelectedId ? (
                                  <div className="p-8 text-center text-[#ef4444] bg-[#ef4444]/10 rounded-xl border border-[#ef4444]/20 font-medium m-1">
                                    {t("reports.compare.error")}
                                  </div>
                                ) : compare?.previous ? (
                                  <div className="bg-[#0b0e12] rounded-xl border border-[#ffffff1a] p-5 lg:p-6 shadow-sm">
                                    <ReportComparisonDetails comparison={compare} />
                                  </div>
                                 ) : loadingCompareId === effectiveSelectedId ? (
                                  <div className="p-8 text-center text-[#94a3b8] bg-[#0b0e12] rounded-xl border border-[#ffffff1a] m-1 animate-pulse">
                                    {t("reports.compare.loading") || t("reports.loading")}
                                  </div>
                                ) : (
                                  <div className="p-8 text-center text-[#94a3b8] bg-[#0b0e12] rounded-xl border border-[#ffffff1a] m-1">
                                    {t("reports.compare.noPrevious")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="bg-[#0e1218] border border-[#ffffff1a] rounded-3xl p-8 flex items-center justify-center min-h-[400px]">
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
