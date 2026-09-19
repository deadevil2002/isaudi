"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { User } from "@/lib/db/client";
import Link from "next/link";
import { StoreSetup } from '@/components/dashboard/store-setup';
import { GenerateAnalysis } from '@/components/dashboard/generate-analysis';
import { ReportView } from '@/components/dashboard/report-view';
import { ChatPanel } from '@/components/dashboard/chat-panel';
import { createTranslator } from "@/lib/i18n/translations";

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

interface TrendSnapshot {
  id: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  grossSales: number;
  totalProfit: number;
  marginPct: number;
  ordersCount: number;
}

export function DashboardClient({
  user,
  stats,
  storeConnection,
  latestReport
}: {
  user: User,
  stats?: { products: number; orders: number; sales: number; excludedOrdersCount?: number; excludedSalesHalala?: number } | null,
  storeConnection?: Record<string, unknown> | null,
  latestReport?: { id: string; reportJson: string; [key: string]: unknown } | null
}) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [report, setReport] = useState(latestReport);
  const [trend, setTrend] = useState<TrendSnapshot[]>([]);
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  const [insightsBlock, setInsightsBlock] = useState<InsightsBlock | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const parsedReport = report?.reportJson ? JSON.parse(report.reportJson) : null;
  const missingCosts = parsedReport?.profitability?.missingCostProductsCount || 0;
  
  const isPremium = user.plan !== 'free';

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

  // Logic for display flow
  const showSetup = !storeConnection;
  const showGenerate = storeConnection && !report;
  const showReport = !!report;

  useEffect(() => {
    if (!isPremium) {
      // Avoid calling setState synchronously during render by moving this
      // to a microtask if needed, or better, we just derive it if possible.
      // But for here, we can set it via a timeout or just know it's fine
      // inside useEffect (ESLint warns about synchronous state updates in effects).
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
  }, [isPremium, t]);

  return (
    <div className="space-y-6 text-[#f0f4f8]">
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
                          if (res.ok) {
                            window.location.reload();
                          }
                        } catch {
                        }
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
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#e6b95c]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <div className="text-[#e6b95c] mb-2 text-sm font-bold tracking-wider">{t("dashboard.plan.label")}</div>
                  <div className="text-4xl font-bold mb-3 capitalize">{planName}</div>
                  <p className="text-[#94a3b8] text-sm max-w-md leading-relaxed">
                    {isPremium ? t("dashboard.plan.premiumDesc") : t("dashboard.plan.upgradeDesc")}
                  </p>
                </div>
                <Link href="/billing">
                  <Button className="bg-[#e6b95c] text-black hover:bg-[#c5993c] border-0 shadow-xl whitespace-nowrap rounded-full px-6 py-2 font-bold text-white">
                    {isPremium ? t("dashboard.plan.manage") : t("dashboard.plan.upgrade")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Overview (if data exists and we are not in setup/generate flow) */}
            {hasData && storeConnection && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm">
                    <div className="text-sm text-[#94a3b8] mb-2">
                    {t("dashboard.stats.productsLabel")} {t("dashboard.stats.productsNote")}
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {stats.products}
                    </div>
                  </div>
                  <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm">
                    <div className="text-sm text-[#94a3b8] mb-2">
                    {t("dashboard.stats.ordersLabel")} {t("dashboard.stats.ordersNote")}
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalOrders ?? stats.orders) : stats.orders}
                    </div>
                  </div>
                  <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm">
                    <div className="text-sm text-[#94a3b8] mb-2">
                    {t("dashboard.stats.salesLabel")} {t("dashboard.stats.salesNote")}
                    </div>
                    <div className="text-3xl font-bold text-[#0fc9a7]">
                      {report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalSales ?? (stats.sales / 100)).toLocaleString() : (stats.sales / 100).toLocaleString()} SAR
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
                  {/* Dedup banner */}
                  {parsedReport?.snapshot?.deduped && (
                    <div className="md:col-span-3 mt-1 text-xs text-[#0fc9a7] bg-[#0fc9a7]/10 border border-[#0fc9a7]/20 rounded-xl p-3">
                      {t("dashboard.banner.dedup")}
                    </div>
                  )}
                    <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm flex items-center justify-between">
                    <div className="text-lg font-bold text-white mb-2 text-white">
                      {t("dashboard.costs.card.title")}
                    </div>
                    <Link href="/dashboard/costs">
                      <Button className="bg-[#0fc9a7]/10 text-[#0fc9a7] hover:bg-[#0fc9a7]/20 border border-[#0fc9a7]/20 whitespace-nowrap rounded-full">
                        {t("dashboard.costs.card.button")}
                      </Button>
                    </Link>
                  </div>
                    {missingCosts > 0 && (
                    <div className="md:col-span-2 bg-[#e6b95c]/10 border border-[#e6b95c]/30 text-[#e6b95c] p-6 rounded-3xl shadow-sm flex items-center justify-between">
                      <div className="text-lg font-bold text-white mb-2 text-white">
                        {t("dashboard.costs.missing").replace("{count}", String(missingCosts))}
                      </div>
                      <Link href="/dashboard/costs">
                        <Button variant="outline" className="border-[#e6b95c]/50 text-[#e6b95c] hover:bg-[#e6b95c]/20 hover:text-[#e6b95c] rounded-full">
                          {t("dashboard.costs.enterNow")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
                {/* Weekly Trend (Paid) */}
                <div className="mt-6">
                  <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xl font-bold text-white">
                        {t("dashboard.trend.title")}
                      </div>
                      {!isPremium && (
                        <Link href="/pricing" className="text-sm text-[#e6b95c] hover:text-[#f9d889] transition-colors">
                          {t("common.upgrade")}
                        </Link>
                      )}
                    </div>
                    {!isPremium ? (
                      <div className="relative">
                        <div className="opacity-30 select-none pointer-events-none">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div key={`lock-${idx}`} className="p-4 rounded-2xl border border-[#ffffff1a] bg-[#0e1218] hover:border-white/10 transition-colors">
                                <div className="text-xs text-[#64748b]">
                                  {t("dashboard.trend.lock.week")}
                                </div>
                                <div className="text-lg font-bold text-white mb-2">—</div>
                                <div className="text-xs text-[#64748b]">
                                  {t("dashboard.trend.lock.metrics")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-lg font-bold text-white mb-2 bg-[#161c24]/90 backdrop-blur-md border border-[#ffffff1a] rounded-xl px-6 py-3 text-white">
                            {t("dashboard.trend.lock.message")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          className="text-sm text-[#94a3b8] mb-4 border border-[#ffffff1a] hover:bg-white/5 rounded-full px-4 py-1.5 transition-colors"
                          onClick={async () => {
                            if (loadingTrend) return;
                            setLoadingTrend(true);
                            try {
                              const resGen = await fetch('/api/reports/generate-weekly', {
                                method: 'POST',
                                cache: 'no-store'
                              });
                              if (resGen.status === 401 || resGen.status === 403) {
                                setCompare(null);
                                setTrend([]);
                                return;
                              }
                              const res = await fetch('/api/reports?range=weekly&limit=12', { cache: 'no-store' });
                              if (res.status === 401 || res.status === 403) {
                                setCompare(null);
                                setTrend([]);
                                return;
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
                          {loadingTrend
                            ? t("dashboard.trend.refresh.loading")
                            : t("dashboard.trend.refresh")}
                        </button>
                        {trend.length > 0 && (
                          <div className="mb-6 text-sm bg-[#0e1218] border border-[#ffffff1a] rounded-2xl p-5">
                            <div className="font-bold text-white text-white mb-3">
                              {t("dashboard.trend.summary.title")}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <div>
                                {t("common.sales")}{" "}
                                <span className="font-bold text-white">
                                  {(trend[0].grossSales || 0).toLocaleString()} SAR
                                </span>
                              </div>
                              <div>
                                {t("common.profit")}{" "}
                                <span className="font-bold text-white">
                                  {(trend[0].totalProfit || 0).toLocaleString()} SAR
                                </span>
                              </div>
                              <div>
                                {t("common.margin")}{" "}
                                <span className="font-bold text-white">
                                  {(trend[0].marginPct || 0).toFixed(2)}%
                                </span>
                              </div>
                              <div>
                                {t("common.orders")}{" "}
                                <span className="font-bold text-white">
                                  {trend[0].ordersCount || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {compare && (
                          <div className="mb-6 text-sm bg-[#0e1218] border border-[#ffffff1a] rounded-2xl p-5">
                            <span className="text-[#94a3b8]">
                              {t("dashboard.compare.label")}
                            </span>
                            <span className={
                              compare.status === 'improved' ? 'text-[#0fc9a7] font-bold' :
                              compare.status === 'declined' ? 'text-[#ef4444] font-bold' : 'text-[#94a3b8]'
                            }>
                              {compare.status === 'improved'
                                ? t("common.status.improved")
                                : compare.status === 'declined'
                                ? t("common.status.declined")
                                : t("common.status.noChange")}
                            </span>
                            <div className="text-xs text-[#94a3b8] mt-1">
                              {t("dashboard.compare.delta.sales")}
                              {compare.deltas.salesDeltaPct == null
                                ? '—'
                                : `${compare.deltas.salesDeltaPct.toFixed(2)}%`}{" "}
                              •{" "}
                              {t("dashboard.compare.delta.profit")}
                              {compare.deltas.profitDeltaPct == null
                                ? '—'
                                : `${compare.deltas.profitDeltaPct.toFixed(2)}%`}{" "}
                              •{" "}
                              {t("dashboard.compare.delta.margin")}
                              {compare.deltas.marginDeltaPct == null
                                ? '—'
                                : `${compare.deltas.marginDeltaPct.toFixed(2)}${t("dashboard.compare.delta.marginPts")}`}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {trend.slice(0, 4).map((w: TrendSnapshot) => (
                            <div key={w.id} className="p-4 rounded-2xl border border-[#ffffff1a] bg-[#0e1218] hover:border-white/10 transition-colors">
                              <div className="text-xs text-[#64748b]">
                                {new Date(w.timeRangeStart).toLocaleDateString()} —{" "}
                                {new Date(w.timeRangeEnd).toLocaleDateString()}
                              </div>
                              <div className="text-lg font-bold text-white mb-2">
                                {(w.grossSales || 0).toLocaleString()} SAR
                              </div>
                              <div className="text-xs text-[#94a3b8]">
                                {t("dashboard.trend.card.profit")}
                                {(w.totalProfit || 0).toLocaleString()} SAR •{" "}
                                {t("dashboard.trend.card.margin")}
                                {(w.marginPct || 0).toFixed(2)}% •{" "}
                                {t("dashboard.trend.card.orders")}
                                {w.ordersCount || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="bg-[#161c24] p-6 rounded-3xl border border-[#ffffff1a] shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xl font-bold text-white">
                        {t("dashboard.insights.title")}
                      </div>
                      {!isPremium && (
                        <Link href="/pricing" className="text-sm text-[#e6b95c] hover:text-[#f9d889] transition-colors">
                          {t("common.upgrade")}
                        </Link>
                      )}
                    </div>
                    {!isPremium ? (
                      <div className="relative">
                        <div className="opacity-30 select-none pointer-events-none">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-bold text-white mb-1">
                                {t("dashboard.insights.keyHighlights")}
                              </div>
                              <ul className="list-disc pr-4 space-y-1">
                                <li>
                                  {t("dashboard.insights.placeholder.summary")}
                                </li>
                                <li>
                                  {t("dashboard.insights.placeholder.profitable")}
                                </li>
                                <li>
                                  {t("dashboard.insights.placeholder.lowMargin")}
                                </li>
                              </ul>
                            </div>
                            <div>
                              <div className="font-bold text-white mb-1">
                                {t("dashboard.insights.suggestedActions")}
                              </div>
                              <ul className="list-disc pr-4 space-y-1">
                                <li>
                                  {t("dashboard.insights.placeholder.actionsMargin")}
                                </li>
                                <li>
                                  {t("dashboard.insights.placeholder.actionsWinners")}
                                </li>
                                <li>
                                  {t("dashboard.insights.placeholder.actionsReview")}
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-lg font-bold text-white mb-2 bg-[#161c24]/90 backdrop-blur-md border border-[#ffffff1a] rounded-xl px-6 py-3 text-white">
                            {t("dashboard.insights.lock.message")}
                          </div>
                        </div>
                      </div>
                    ) : loadingInsights ? (
                      <div className="text-xs text-[#64748b]">
                        {t("dashboard.insights.loading")}
                      </div>
                    ) : insightsError ? (
                      <div className="text-xs text-[#64748b]">{insightsError}</div>
                    ) : insightsBlock ? (
                      <div className="space-y-4 text-sm text-[#94a3b8]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-bold text-white mb-1">
                            {t("dashboard.insights.keyHighlights")}
                            </div>
                            {Array.isArray(insightsBlock.insights) && insightsBlock.insights.length > 0 ? (
                              <ul className="list-disc pr-4 space-y-1">
                                {insightsBlock.insights.map((line: string, idx: number) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-[#64748b]">
                                {t("dashboard.insights.noHighlights")}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white mb-1">
                              {t("dashboard.insights.suggestedActions")}
                            </div>
                            {Array.isArray(insightsBlock.actionItems) && insightsBlock.actionItems.length > 0 ? (
                              <ul className="list-disc pr-4 space-y-1">
                                {insightsBlock.actionItems.map((line: string, idx: number) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-[#64748b]">
                                {t("dashboard.insights.noActions")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-bold text-white mb-1">
                              {t("dashboard.insights.topProfitProducts")}
                            </div>
                            {Array.isArray(insightsBlock.topProfitProducts) && insightsBlock.topProfitProducts.length > 0 ? (
                              <ul className="space-y-1">
                                {insightsBlock.topProfitProducts.map((p, idx: number) => {
                                  const profitText = p.profitSar?.toLocaleString?.() ?? p.profitSar;
                                  const marginText = p.marginPct?.toFixed?.(2) ?? p.marginPct;
                                  const template = t("dashboard.insights.productProfitLine");
                                  const line = template
                                    .replace("{profit}", String(profitText))
                                    .replace("{margin}", String(marginText));
                                  return (
                                    <li key={idx}>
                                      <span className="font-bold text-white">{p.name}</span>
                                      {p.sku ? ` (SKU: ${p.sku})` : ""}{" "}
                                      {line}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="text-[#64748b]">
                                {t("dashboard.insights.notEnoughProfitData")}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white mb-1">
                              {t("dashboard.insights.lowMarginProducts")}
                            </div>
                            {Array.isArray(insightsBlock.lowMarginProducts) && insightsBlock.lowMarginProducts.length > 0 ? (
                              <ul className="space-y-1">
                                {insightsBlock.lowMarginProducts.map((p, idx: number) => {
                                  const profitText = p.profitSar?.toLocaleString?.() ?? p.profitSar;
                                  const marginText = p.marginPct?.toFixed?.(2) ?? p.marginPct;
                                  const template = t("dashboard.insights.productProfitLine");
                                  const line = template
                                    .replace("{profit}", String(profitText))
                                    .replace("{margin}", String(marginText));
                                  return (
                                    <li key={idx}>
                                      <span className="font-bold text-white">{p.name}</span>
                                      {p.sku ? ` (SKU: ${p.sku})` : ""}{" "}
                                      {line}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="text-[#64748b]">
                                {t("dashboard.insights.noLowMargin")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#64748b]">
                        {t("dashboard.insights.noData")}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}


            {/* Main Flow */}
            <div className="mt-8">
              {showSetup && <StoreSetup />}
              
              {showGenerate && (
                <GenerateAnalysis 
                  onGenerated={(newReport) => {
                     setReport(newReport);
                     router.refresh();
                  }}
                  freeReportsUsed={user.freeReportsUsed || 0}
                  isPremium={isPremium}
                />
              )}

              {showReport && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {!isPremium && (
                    <div className="lg:col-span-3">
                      <div className="flex flex-col items-start gap-4 rounded-3xl border border-[#ffffff1a] bg-[#161c24] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 break-words text-lg font-bold text-white">
                          {t("dashboard.freeBanner.text").replace(
                            "{count}",
                            String(Math.max(0, 2 - (user.freeReportsUsed || 0)))
                          )}
                        </div>
                        <div className="shrink-0">
                          <Button 
                            disabled={(user.freeReportsUsed || 0) >= 2}
                            onClick={() => router.push('/connect/csv')}
                            className="whitespace-nowrap"
                          >
                            {t("dashboard.freeBanner.button")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="lg:col-span-2">
                    <ReportView report={report} />
                  </div>
                  <div className="lg:col-span-1">
                    <ChatPanel 
                      reportId={report.id}
                      freeReportsUsed={user.freeReportsUsed || 0}
                      isPremium={isPremium}
                    />
                  </div>
                </div>
              )}
            </div>

    </div>
  );
}
