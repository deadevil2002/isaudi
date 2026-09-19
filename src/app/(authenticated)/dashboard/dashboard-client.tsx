"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { User } from "@/lib/db/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreSetup } from '@/components/dashboard/store-setup';
import { GenerateAnalysis } from '@/components/dashboard/generate-analysis';
import { ReportView } from '@/components/dashboard/report-view';
import { ChatPanel } from '@/components/dashboard/chat-panel';
import { createTranslator } from "@/lib/i18n/translations";
import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { InsightCard } from '@/components/dashboard/insight-card';
import { Skeleton } from '@/components/dashboard/skeleton';
import { Lightbulb, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface InsightsBlock {
  insights?: string[];
  actionItems?: string[];
  topProfitProducts?: { name: string; sku?: string; profitSar?: number; marginPct?: number }[];
  lowMarginProducts?: { name: string; sku?: string; profitSar?: number; marginPct?: number }[];
}

interface CompareData {
  status: 'improved' | 'declined' | 'noChange';
  deltas: {
    salesDeltaPct: number | null;
    profitDeltaPct: number | null;
    marginDeltaPct: number | null;
  };
}

export interface TrendSnapshot {
  id: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  grossSales: number;
  totalProfit: number;
  marginPct: number;
  ordersCount: number;
}

export interface DashboardPreviewProps {
  dataState?: "populated" | "loading" | "empty" | "error";
  trend?: TrendSnapshot[];
  loadingTrend?: boolean;
  compare?: CompareData | null;
  insightsBlock?: InsightsBlock | null;
  loadingInsights?: boolean;
  insightsError?: string | null;
  freeReportsUsed?: number;
  generateReport?: () => Promise<{ id: string; reportJson: string; [key: string]: unknown }>;
  analysisState?: "idle" | "loading" | "error";
  analysisError?: string;
  onUpgrade?: () => void;
  chatSendMessage?: (message: string, reportId: string) => Promise<string>;
  chatInitialMessages?: { role: 'user' | 'assistant'; content: string }[];
  chatFallbackForm?: {
    action: string;
    fields: Record<string, string>;
    inputName: string;
  };
  onConnectSalla?: () => void;
  onUploadCsv?: () => void;
  onNavigateCosts?: (e: React.MouseEvent) => void;
  onNavigateBilling?: (e: React.MouseEvent) => void;
  isDev?: boolean;
}

export function DashboardClient({
  user,
  stats,
  storeConnection,
  latestReport,
  previewProps
}: {
  user: User;
  stats?: { products: number; orders: number; sales: number; excludedOrdersCount?: number; excludedSalesHalala?: number } | null;
  storeConnection?: Record<string, unknown> | null;
  latestReport?: { id: string; reportJson: string; [key: string]: unknown } | null;
  previewProps?: DashboardPreviewProps;
}) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [report, setReport] = useState(latestReport);
  const [trend, setTrend] = useState<TrendSnapshot[]>(previewProps?.trend || []);
  const [compare, setCompare] = useState<CompareData | null>(previewProps?.compare || null);
  const [loadingTrend, setLoadingTrend] = useState(previewProps?.loadingTrend || false);
  const isDev = previewProps && previewProps.isDev !== undefined ? previewProps.isDev : (!previewProps && process.env.NODE_ENV === 'development');
  const [insightsBlock, setInsightsBlock] = useState<InsightsBlock | null>(previewProps?.insightsBlock || null);
  const [loadingInsights, setLoadingInsights] = useState(previewProps?.loadingInsights || false);
  const [insightsError, setInsightsError] = useState<string | null>(previewProps?.insightsError || null);
  const parsedReport = report?.reportJson ? JSON.parse(report.reportJson) : null;
  const missingCosts = parsedReport?.profitability?.missingCostProductsCount || 0;

  const isPremium = user.plan !== 'free';

  const userWithFreeReports = user as typeof user & { freeReportsUsed?: number };
  const actualFreeReportsUsed = previewProps?.freeReportsUsed ?? userWithFreeReports.freeReportsUsed ?? 0;
  const previewDataState = previewProps?.dataState;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setReport(latestReport), 0);
    return () => window.clearTimeout(timeoutId);
  }, [latestReport]);

  useEffect(() => {
    if (previewProps) {
      const tId = setTimeout(() => {
        if (previewProps.trend !== undefined) setTrend(previewProps.trend);
        if (previewProps.compare !== undefined) setCompare(previewProps.compare);
        if (previewProps.loadingTrend !== undefined) setLoadingTrend(previewProps.loadingTrend);
        if (previewProps.insightsBlock !== undefined) setInsightsBlock(previewProps.insightsBlock);
        if (previewProps.loadingInsights !== undefined) setLoadingInsights(previewProps.loadingInsights);
        if (previewProps.insightsError !== undefined) setInsightsError(previewProps.insightsError);
      }, 0);
      return () => clearTimeout(tId);
    }
  }, [previewProps]);

  const t = createTranslator(lang);

  const planName =
    user.plan === "free"
      ? t("billing.freeBadge")
      : user.plan === "starter"
      ? t("billing.plan.basic")
      : user.plan === "growth"
      ? t("billing.plan.pro")
      : user.plan === "business"
      ? t("billing.plan.business")
      : user.plan;
  const hasData = stats && (stats.products > 0 || stats.orders > 0);

  const showSetup = !storeConnection;
  const showGenerate = storeConnection && !report;
  const showReport = !!report;

  useEffect(() => {
    if (previewProps) return;
    if (!isPremium) {
      const tId = setTimeout(() => {
        setInsightsBlock(null);
        setInsightsError(null);
      }, 0);
      return () => clearTimeout(tId);
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingInsights(true);
        setInsightsError(null);
        const resSnaps = await fetch('/api/reports?range=weekly&limit=1', { cache: 'no-store' });
        if (!resSnaps.ok) {
          if (!cancelled) setInsightsError(t("dashboard.insights.error.weeklyLoad"));
          return;
        }
        const dataSnaps = await resSnaps.json();
        const snaps = dataSnaps.snapshots || (Array.isArray(dataSnaps) ? dataSnaps : []);
        if (snaps.length === 0) {
          if (!cancelled) setInsightsError(t("dashboard.insights.error.noWeekly"));
          return;
        }
        const currentId = snaps[0].id;
        const resInsight = await fetch(`/api/reports/insights?current=${encodeURIComponent(currentId)}&previous=auto`, { cache: 'no-store' });
        if (resInsight.status === 403) {
          if (!cancelled) setInsightsError(t("dashboard.insights.error.paidOnly"));
          return;
        }
        if (!resInsight.ok) {
          if (!cancelled) setInsightsError(t("dashboard.insights.error.smartSummary"));
          return;
        }
        const insightData = await resInsight.json();
        if (!cancelled) {
          setInsightsBlock(insightData);
        }
      } catch {
        if (!cancelled) setInsightsError(t("dashboard.insights.error.smartSummary"));
      } finally {
        if (!cancelled) setLoadingInsights(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPremium, t, previewProps]);

  return (
    <div className="space-y-8 text-[#f0f4f8]">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-white [overflow-wrap:anywhere] sm:text-3xl">
          {t("dashboard.welcomeLine").replace("{email}", user.email)}
        </h1>
      </div>

      {isDev && (
        <div className="bg-[#161c24] border border-[#e6b95c]/30 rounded-2xl p-4 text-xs text-[#94a3b8] flex flex-col gap-2">
          <div className="font-bold text-white">{t("dashboard.dev.modeTitle")}</div>
          <div>{t("dashboard.dev.currentPlan")} <span className="font-bold">{planName}</span> ({user.plan})</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {['free', 'starter', 'growth', 'business'].map((p) => (
              <button
                key={p}
                className={`px-2 py-1 rounded-lg border text-xs transition-colors ${
                  user.plan === p
                    ? 'bg-[#e6b95c] text-black border-[#e6b95c]'
                    : 'bg-[#0e1218] text-[#94a3b8] border-[#ffffff1a] hover:border-white/30'
                }`}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/dev/set-plan', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plan: p })
                    });
                    if (res.ok) window.location.reload();
                  } catch {}
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan Card */}
      <div className="bg-[#161c24] border border-[#ffffff1a] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e6b95c]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-[#e6b95c] mb-2 text-sm font-bold tracking-wider">{t("dashboard.plan.label")}</div>
            <div className="text-4xl font-bold mb-3 capitalize">{planName}</div>
            <p className="text-[#94a3b8] text-sm max-w-md leading-relaxed">
              {isPremium ? t("dashboard.plan.premiumDesc") : t("dashboard.plan.upgradeDesc")}
            </p>
          </div>
          <Link href={previewProps ? "#" : "/billing"} onClick={previewProps?.onNavigateBilling ? (e) => { e.preventDefault(); previewProps.onNavigateBilling!(e); } : previewProps ? (e) => e.preventDefault() : undefined}>
            <Button className="bg-[#e6b95c] text-black hover:bg-[#c5993c] border-0 shadow-xl whitespace-nowrap rounded-full px-6 py-2 font-bold text-black transition-transform hover:scale-105 active:scale-95">
              {isPremium ? t("dashboard.plan.manage") : t("dashboard.plan.upgrade")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {hasData && storeConnection && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm hover:border-white/10 transition-colors">
              <div className="text-sm text-[#94a3b8] mb-2">
                {t("dashboard.stats.productsLabel")} {t("dashboard.stats.productsNote")}
              </div>
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber value={stats.products} />
              </div>
            </div>
            <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm hover:border-white/10 transition-colors">
              <div className="text-sm text-[#94a3b8] mb-2">
                {t("dashboard.stats.ordersLabel")} {t("dashboard.stats.ordersNote")}
              </div>
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber value={report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalOrders ?? stats.orders) : stats.orders} />
              </div>
            </div>
            <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm hover:border-white/10 transition-colors">
              <div className="text-sm text-[#94a3b8] mb-2">
                {t("dashboard.stats.salesLabel")} {t("dashboard.stats.salesNote")}
              </div>
              <div className="text-3xl font-bold text-[#0fc9a7]">
                <AnimatedNumber
                  value={report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalSales ?? (stats.sales / 100)) : (stats.sales / 100)}
                  formatter={(v) => `${v.toLocaleString()} SAR`}
                />
              </div>
            </div>
          </div>

          {((stats.excludedOrdersCount ?? 0) > 0 || (stats.excludedSalesHalala ?? 0) > 0) && (
            <div className="text-xs text-[#64748b]">
              {t("dashboard.stats.excluded")
                .replace("{orders}", String(stats.excludedOrdersCount || 0))
                .replace("{amount}", ((stats.excludedSalesHalala ?? 0) / 100).toFixed(2))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {parsedReport?.snapshot?.deduped && (
              <div className="md:col-span-3 text-xs text-[#0fc9a7] bg-[#0fc9a7]/10 border border-[#0fc9a7]/20 rounded-xl p-4">
                {t("dashboard.banner.dedup")}
              </div>
            )}

            <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm flex items-center justify-between hover:border-white/10 transition-colors">
              <div className="text-lg font-bold text-white">
                {t("dashboard.costs.card.title")}
              </div>
              <Link href={previewProps ? "#" : "/dashboard/costs"} onClick={previewProps?.onNavigateCosts ? (e) => { e.preventDefault(); previewProps.onNavigateCosts!(e); } : previewProps ? (e) => e.preventDefault() : undefined}>
                <Button className="bg-[#0fc9a7]/10 text-[#0fc9a7] hover:bg-[#0fc9a7]/20 border border-[#0fc9a7]/20 whitespace-nowrap rounded-full transition-transform hover:scale-105 active:scale-95">
                  {t("dashboard.costs.card.button")}
                </Button>
              </Link>
            </div>

            {missingCosts > 0 && (
              <div className="md:col-span-2 bg-[#e6b95c]/10 border border-[#e6b95c]/30 text-[#e6b95c] p-6 rounded-3xl shadow-sm flex items-center justify-between">
                <div className="text-lg font-bold text-white">
                  {t("dashboard.costs.missing").replace("{count}", String(missingCosts))}
                </div>
                <Link href={previewProps ? "#" : "/dashboard/costs"} onClick={previewProps?.onNavigateCosts ? (e) => { e.preventDefault(); previewProps.onNavigateCosts!(e); } : previewProps ? (e) => e.preventDefault() : undefined}>
                  <Button variant="outline" className="border-[#e6b95c]/50 text-[#e6b95c] hover:bg-[#e6b95c]/20 hover:text-[#e6b95c] rounded-full transition-transform hover:scale-105 active:scale-95">
                    {t("dashboard.costs.enterNow")}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Weekly Trend (Paid) */}
          <div className="mt-6">
            <div className="bg-[#161c24] p-6 sm:p-8 rounded-3xl border border-[#ffffff1a] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="text-xl font-bold text-white">
                  {t("dashboard.trend.title")}
                </div>
                {!isPremium && (
                  <Link href={previewProps ? "#" : "/pricing"} onClick={previewProps?.onNavigateBilling ? (e) => { e.preventDefault(); previewProps.onNavigateBilling!(e); } : previewProps ? (e) => e.preventDefault() : undefined} className="text-sm text-[#e6b95c] hover:text-[#f9d889] transition-colors border border-[#e6b95c]/30 px-4 py-1.5 rounded-full hover:bg-[#e6b95c]/10">
                    {t("common.upgrade")}
                  </Link>
                )}
              </div>
              {!isPremium ? (
                <div className="relative">
                  <div className="opacity-30 select-none pointer-events-none filter blur-[2px]">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`lock-${idx}`} className="p-4 rounded-2xl border border-[#ffffff1a] bg-[#0e1218]">
                          <div className="text-xs text-[#64748b]">{t("dashboard.trend.lock.week")}</div>
                          <div className="text-lg font-bold text-white mb-2">—</div>
                          <div className="text-xs text-[#64748b]">{t("dashboard.trend.lock.metrics")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-sm font-bold bg-[#161c24]/90 backdrop-blur-md border border-[#e6b95c]/30 rounded-full px-6 py-3 text-[#e6b95c] shadow-[0_0_20px_rgba(230,185,92,0.15)]">
                      {t("dashboard.trend.lock.message")}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      className="text-sm text-[#94a3b8] border border-[#ffffff1a] hover:bg-white/5 rounded-full px-4 py-1.5 transition-colors active:scale-95"
                      onClick={async () => {
                        if (previewProps) return;
                        if (loadingTrend) return;
                        setLoadingTrend(true);
                        try {
                          const resGen = await fetch('/api/reports/generate-weekly', { method: 'POST', cache: 'no-store' });
                          if (resGen.status === 401 || resGen.status === 403) {
                            setCompare(null); setTrend([]); return;
                          }
                          const res = await fetch('/api/reports?range=weekly&limit=12', { cache: 'no-store' });
                          if (res.status === 401 || res.status === 403) {
                            setCompare(null); setTrend([]); return;
                          }
                          const data = await res.json();
                          const snaps = data.snapshots || (Array.isArray(data) ? data : []);
                          setTrend(snaps);
                          if (snaps.length >= 1) {
                            const curId = snaps[0].id;
                            const resCmp = await fetch(`/api/reports/compare?current=${encodeURIComponent(curId)}&previous=auto`, { cache: 'no-store' });
                            if (resCmp.status === 401 || resCmp.status === 403) {
                              setCompare(null);
                            } else {
                              const cmp = await resCmp.json();
                              setCompare(cmp);
                            }
                          } else {
                            setCompare(null);
                          }
                        } finally {
                          setLoadingTrend(false);
                        }
                      }}
                    >
                      {loadingTrend ? t("dashboard.trend.refresh.loading") : t("dashboard.trend.refresh")}
                    </button>

                    {compare && (
                      <div className="text-sm border border-[#ffffff1a] rounded-full px-4 py-1.5 flex items-center gap-2">
                        <span className="text-[#94a3b8]">{t("dashboard.compare.label")}</span>
                        <span className={
                          compare.status === 'improved' ? 'text-[#0fc9a7] font-bold flex items-center gap-1' :
                          compare.status === 'declined' ? 'text-[#ef4444] font-bold flex items-center gap-1' : 'text-[#94a3b8] font-bold'
                        }>
                          {compare.status === 'improved' ? <><TrendingUp className="w-4 h-4"/>{t("common.status.improved")}</> :
                           compare.status === 'declined' ? <><TrendingDown className="w-4 h-4"/>{t("common.status.declined")}</> : t("common.status.noChange")}
                        </span>
                      </div>
                    )}
                  </div>

                  {loadingTrend ? (
                    <Skeleton className="w-full h-[240px]" />
                  ) : trend.length > 0 ? (
                    <div className="pt-4 pb-2">
                      <TrendChart data={trend} />
                    </div>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-[#64748b] border border-[#ffffff1a] border-dashed rounded-xl">
                      {t("dashboard.trend.lock.metrics")} {/* fallback text */}
                    </div>
                  )}

                  {trend.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      {trend.slice(0, 4).map((w: TrendSnapshot) => (
                        <div key={w.id} className="p-4 rounded-2xl border border-[#ffffff1a] bg-[#0e1218] hover:border-white/10 transition-colors">
                          <div className="text-xs text-[#94a3b8] mb-1">
                            {new Date(w.timeRangeStart).toLocaleDateString()} — {new Date(w.timeRangeEnd).toLocaleDateString()}
                          </div>
                          <div className="text-lg font-bold text-white mb-2">
                            <AnimatedNumber value={w.grossSales || 0} formatter={(v) => `${v.toLocaleString()} SAR`} />
                          </div>
                          <div className="text-xs text-[#64748b] flex flex-col gap-1">
                            <span className={w.totalProfit < 0 ? "text-[#ef4444]" : "text-[#0fc9a7]"}>
                              <AnimatedNumber
                                value={w.totalProfit || 0}
                                formatter={(v) => `${v > 0 ? "+" : ""}${v.toLocaleString()} SAR`}
                              />
                            </span>
                            <span className="text-white"><AnimatedNumber value={w.marginPct || 0} formatter={(v) => `${v.toFixed(1)}% margin`} /></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="bg-[#161c24] p-6 sm:p-8 rounded-3xl border border-[#ffffff1a] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="text-xl font-bold text-white">
                  {t("dashboard.insights.title")}
                </div>
                {!isPremium && (
                  <Link href={previewProps ? "#" : "/pricing"} onClick={previewProps?.onNavigateBilling ? (e) => { e.preventDefault(); previewProps.onNavigateBilling!(e); } : previewProps ? (e) => e.preventDefault() : undefined} className="text-sm text-[#e6b95c] hover:text-[#f9d889] transition-colors border border-[#e6b95c]/30 px-4 py-1.5 rounded-full hover:bg-[#e6b95c]/10">
                    {t("common.upgrade")}
                  </Link>
                )}
              </div>

              {!isPremium ? (
                <div className="relative">
                  <div className="opacity-30 select-none pointer-events-none filter blur-[2px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="font-bold text-white mb-3">{t("dashboard.insights.keyHighlights")}</div>
                        <ul className="list-disc pr-4 space-y-2 text-[#94a3b8]">
                          <li>{t("dashboard.insights.placeholder.summary")}</li>
                          <li>{t("dashboard.insights.placeholder.profitable")}</li>
                        </ul>
                      </div>
                      <div className="bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a]">
                        <div className="font-bold text-white mb-3">{t("dashboard.insights.suggestedActions")}</div>
                        <ul className="list-disc pr-4 space-y-2 text-[#94a3b8]">
                          <li>{t("dashboard.insights.placeholder.actionsMargin")}</li>
                          <li>{t("dashboard.insights.placeholder.actionsWinners")}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-sm font-bold bg-[#161c24]/90 backdrop-blur-md border border-[#e6b95c]/30 rounded-full px-6 py-3 text-[#e6b95c] shadow-[0_0_20px_rgba(230,185,92,0.15)]">
                      {t("dashboard.insights.lock.message")}
                    </div>
                  </div>
                </div>
              ) : loadingInsights ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : insightsError ? (
                <div className="text-sm text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 p-4 rounded-xl">{insightsError}</div>
              ) : insightsBlock ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <InsightCard
                    theme="teal"
                    icon={<Activity className="w-5 h-5"/>}
                    title={t("dashboard.insights.keyHighlights")}
                    content={
                      Array.isArray(insightsBlock.insights) && insightsBlock.insights.length > 0 ? (
                        <ul className="list-disc px-4 space-y-2">
                          {insightsBlock.insights.map((line: string, idx: number) => (
                            <li key={idx} className="leading-relaxed">{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm opacity-70">{t("dashboard.insights.noHighlights")}</div>
                      )
                    }
                  />

                  <InsightCard
                    theme="gold"
                    icon={<Lightbulb className="w-5 h-5"/>}
                    title={t("dashboard.insights.suggestedActions")}
                    content={
                      Array.isArray(insightsBlock.actionItems) && insightsBlock.actionItems.length > 0 ? (
                        <ul className="list-disc px-4 space-y-2">
                          {insightsBlock.actionItems.map((line: string, idx: number) => (
                            <li key={idx} className="leading-relaxed">{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm opacity-70">{t("dashboard.insights.noActions")}</div>
                      )
                    }
                  />

                  {(insightsBlock.topProfitProducts?.length ?? 0) > 0 && (
                    <InsightCard
                      theme="default"
                      icon={<TrendingUp className="w-5 h-5 text-[#0fc9a7]"/>}
                      title={t("dashboard.reportView.profitability.topProfit")}
                      content={
                        <ul className="space-y-3">
                          {insightsBlock.topProfitProducts!.map((p, i) => (
                            <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-[#ffffff0a]">
                              <span className="font-medium truncate text-white">{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                              <span className="text-[#0fc9a7] whitespace-nowrap text-sm">
                                {p.profitSar != null ? `${p.profitSar.toLocaleString()} SAR` : '—'} • {p.marginPct != null ? `${p.marginPct}%` : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      }
                    />
                  )}

                  {(insightsBlock.lowMarginProducts?.length ?? 0) > 0 && (
                    <InsightCard
                      theme="default"
                      icon={<TrendingDown className="w-5 h-5 text-[#ef4444]"/>}
                      title={t("dashboard.reportView.profitability.worstMargins")}
                      content={
                        <ul className="space-y-3">
                          {insightsBlock.lowMarginProducts!.map((p, i) => (
                            <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-[#ffffff0a]">
                              <span className="font-medium truncate text-white">{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                              <span className="text-[#ef4444] whitespace-nowrap text-sm">
                                {p.profitSar != null ? `${p.profitSar.toLocaleString()} SAR` : '—'} • {p.marginPct != null ? `${p.marginPct}%` : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="text-sm text-[#64748b] bg-[#161c24] border border-[#ffffff1a] border-dashed p-8 rounded-2xl text-center">
                  {t("dashboard.insights.noData")}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Flow: Setup -> Generate -> Report */}
      {previewDataState === "loading" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label={t("reports.loading")}>
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
            <Skeleton className="h-44 rounded-3xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-52 rounded-3xl" />
              <Skeleton className="h-52 rounded-3xl" />
            </div>
          </div>
          <Skeleton className="h-[36rem] rounded-3xl lg:col-span-1" />
        </div>
      ) : previewDataState === "error" ? (
        <div className="rounded-3xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-8 text-center text-sm font-medium text-[#ef4444]">
          {t("reports.error")}
        </div>
      ) : showSetup ? (
        <StoreSetup
          onConnectSalla={previewProps?.onConnectSalla}
          onUploadCsv={previewProps?.onUploadCsv}
        />
      ) : showGenerate ? (
        <GenerateAnalysis
          freeReportsUsed={actualFreeReportsUsed}
          isPremium={isPremium}
          onGenerated={(newReport) => {
            setReport(newReport);
            if (!previewProps) router.refresh();
          }}
          generateReport={previewProps?.generateReport}
          onUpgrade={previewProps?.onUpgrade}
          previewState={previewProps?.analysisState}
          previewError={previewProps?.analysisError}
        />
      ) : showReport ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {!isPremium && (
            <div className="lg:col-span-3">
              <div className="flex flex-col items-start gap-4 rounded-3xl border border-[#ffffff1a] bg-[#161c24] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 break-words text-lg font-bold text-white">
                  {t("dashboard.freeBanner.text").replace(
                    "{count}",
                    String(Math.max(0, 2 - actualFreeReportsUsed)),
                  )}
                </div>
                <Button
                  disabled={actualFreeReportsUsed >= 2}
                  onClick={() => previewProps ? undefined : router.push("/connect/csv")}
                  className="shrink-0 whitespace-nowrap"
                >
                  {t("dashboard.freeBanner.button")}
                </Button>
              </div>
            </div>
          )}
          <div className="lg:col-span-2">
            <ReportView report={report!} />
          </div>
          <div className="lg:col-span-1">
            <ChatPanel
              reportId={report.id}
              freeReportsUsed={actualFreeReportsUsed}
              isPremium={isPremium}
              sendMessage={previewProps?.chatSendMessage}
              initialMessages={previewProps?.chatInitialMessages}
              fallbackForm={previewProps?.chatFallbackForm}
              blockedActionHref={previewProps?.onNavigateBilling ? "#" : undefined}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}