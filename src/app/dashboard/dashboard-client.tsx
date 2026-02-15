"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { User } from "@/lib/db/client";
import { LayoutDashboard, TrendingUp, ShoppingBag, Settings, CreditCard } from "lucide-react";
import Link from "next/link";
import { StoreSetup } from '@/components/dashboard/store-setup';
import { GenerateAnalysis } from '@/components/dashboard/generate-analysis';
import { ReportView } from '@/components/dashboard/report-view';
import { ChatPanel } from '@/components/dashboard/chat-panel';
import { createTranslator } from "@/lib/i18n/translations";

export function DashboardClient({ user, stats, storeConnection, latestReport }: { user: User, stats?: any, storeConnection?: any, latestReport?: any }) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [report, setReport] = useState(latestReport);
  const [trend, setTrend] = useState<any[]>([]);
  const [compare, setCompare] = useState<any | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  const [insightsBlock, setInsightsBlock] = useState<any | null>(null);
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
      setInsightsBlock(null);
      setInsightsError(null);
      return;
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
        const snaps = dataSnaps.snapshots || [];
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
  }, [isPremium]);

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <Container>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 space-y-2">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-4">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-isaudi-green/10 flex items-center justify-center text-isaudi-green font-bold text-lg">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate">{user.email}</div>
                    <div className="text-xs text-gray-500 capitalize">{planName}</div>
                  </div>
               </div>
            </div>
            
            <nav className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-2 bg-white shadow-sm text-isaudi-green font-bold">
                <LayoutDashboard className="w-4 h-4" />
                {t("dashboard.menu.dashboard")}
              </Button>
              <Link href="/dashboard/reports">
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600 hover:bg-white hover:shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.reports")}
                </Button>
              </Link>
              <Link href="/dashboard/costs">
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600 hover:bg-white hover:shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.costs")}
                </Button>
              </Link>
              <Link href="/connect/salla">
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600 hover:bg-white hover:shadow-sm">
                  <ShoppingBag className="w-4 h-4" />
                  {t("dashboard.menu.connectStore")}
                </Button>
              </Link>
              <Link href="/billing" className="block">
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600 hover:bg-white hover:shadow-sm">
                  <CreditCard className="w-4 h-4" />
                  {isPremium ? t("dashboard.plan.manage") : t("dashboard.plan.upgrade")}
                </Button>
              </Link>
              <Link href="/settings" className="block">
                <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600 hover:bg-white hover:shadow-sm">
                  <Settings className="w-4 h-4" />
                  {t("dashboard.menu.settings")}
                </Button>
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                {t("dashboard.welcomeLine").replace("{email}", user.email)}
              </h1>
            </div>

            {isDev && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-xs text-gray-800 flex flex-col gap-2">
                <div className="font-semibold">🔧 {t("dashboard.dev.modeTitle")}</div>
                <div>{t("dashboard.dev.currentPlan")} <span className="font-bold">{planName}</span> ({user.plan})</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['free', 'starter', 'growth', 'business'].map((p) => (
                    <button
                      key={p}
                      className={`px-2 py-1 rounded border text-xs ${
                        user.plan === p
                          ? 'bg-isaudi-green text-white border-isaudi-green'
                          : 'bg-white text-gray-700 border-gray-300'
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
            <div className="bg-gradient-to-br from-isaudi-green to-isaudi-green-dark rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <div className="text-isaudi-green-light mb-1 text-sm font-medium">{t("dashboard.plan.label")}</div>
                  <div className="text-3xl font-bold mb-2 capitalize">{planName}</div>
                  <p className="text-white/80 text-sm max-w-md">
                    {isPremium ? t("dashboard.plan.premiumDesc") : t("dashboard.plan.upgradeDesc")}
                  </p>
                </div>
                <Link href="/billing">
                  <Button className="bg-white text-isaudi-green hover:bg-gray-50 border-0 shadow-xl whitespace-nowrap">
                    {isPremium ? t("dashboard.plan.manage") : t("dashboard.plan.upgrade")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Overview (if data exists and we are not in setup/generate flow) */}
            {hasData && storeConnection && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.stats.productsLabel")} {t("dashboard.stats.productsNote")}
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.products}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.stats.ordersLabel")} {t("dashboard.stats.ordersNote")}
                    </div>
                    <div className="text-2xl font-bold">
                      {report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalOrders ?? stats.orders) : stats.orders}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.stats.salesLabel")} {t("dashboard.stats.salesNote")}
                    </div>
                    <div className="text-2xl font-bold text-isaudi-green">
                      {report?.reportJson ? (JSON.parse(report.reportJson)?.metrics?.totalSales ?? (stats.sales / 100)).toLocaleString() : (stats.sales / 100).toLocaleString()} SAR
                    </div>
                  </div>
                </div>
                {(stats.excludedOrdersCount > 0 || stats.excludedSalesHalala > 0) && (
                  <div className="text-xs text-gray-500">
                    {t("dashboard.stats.excluded")
                      .replace("{orders}", String(stats.excludedOrdersCount || 0))
                      .replace("{amount}", (stats.excludedSalesHalala / 100).toFixed(2))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Dedup banner */}
                  {parsedReport?.snapshot?.deduped && (
                    <div className="md:col-span-3 mt-1 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2">
                      {t("dashboard.banner.dedup")}
                    </div>
                  )}
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="text-sm">
                      {t("dashboard.costs.card.title")}
                    </div>
                    <Link href="/dashboard/costs">
                      <Button className="whitespace-nowrap">
                        {t("dashboard.costs.card.button")}
                      </Button>
                    </Link>
                  </div>
                    {missingCosts > 0 && (
                    <div className="md:col-span-2 bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <div className="text-sm">
                        {t("dashboard.costs.missing").replace("{count}", String(missingCosts))}
                      </div>
                      <Link href="/dashboard/costs">
                        <Button variant="outline" className="border-yellow-300 text-yellow-800">
                          {t("dashboard.costs.enterNow")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
                {/* Weekly Trend (Paid) */}
                <div className="mt-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-base font-semibold">
                        {t("dashboard.trend.title")}
                      </div>
                      {!isPremium && (
                        <Link href="/pricing" className="text-xs text-isaudi-green">
                          {t("common.upgrade")}
                        </Link>
                      )}
                    </div>
                    {!isPremium ? (
                      <div className="relative">
                        <div className="opacity-30 select-none pointer-events-none">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div key={`lock-${idx}`} className="p-3 rounded-lg border bg-gray-50">
                                <div className="text-xs text-gray-500">
                                  {t("dashboard.trend.lock.week")}
                                </div>
                                <div className="text-sm font-medium">—</div>
                                <div className="text-xs text-gray-500">
                                  {t("dashboard.trend.lock.metrics")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-xs bg-white/80 backdrop-blur border rounded-md px-3 py-1">
                            {t("dashboard.trend.lock.message")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          className="text-xs text-gray-600 mb-2 border rounded px-2 py-1"
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
                              const snaps = data.snapshots || [];
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
                          <div className="mb-3 text-xs bg-gray-50 border border-gray-100 rounded-lg p-3">
                            <div className="font-medium text-gray-800 mb-1">
                              {t("dashboard.trend.summary.title")}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <div>
                                {t("common.sales")}{" "}
                                <span className="font-semibold">
                                  {(trend[0].grossSales || 0).toLocaleString()} SAR
                                </span>
                              </div>
                              <div>
                                {t("common.profit")}{" "}
                                <span className="font-semibold">
                                  {(trend[0].totalProfit || 0).toLocaleString()} SAR
                                </span>
                              </div>
                              <div>
                                {t("common.margin")}{" "}
                                <span className="font-semibold">
                                  {(trend[0].marginPct || 0).toFixed(2)}%
                                </span>
                              </div>
                              <div>
                                {t("common.orders")}{" "}
                                <span className="font-semibold">
                                  {trend[0].ordersCount || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {compare && (
                          <div className="mb-3 text-sm">
                            <span className="text-gray-700">
                              {t("dashboard.compare.label")}
                            </span>
                            <span className={
                              compare.status === 'improved' ? 'text-green-600' :
                              compare.status === 'declined' ? 'text-red-600' : 'text-gray-600'
                            }>
                              {compare.status === 'improved'
                                ? t("common.status.improved")
                                : compare.status === 'declined'
                                ? t("common.status.declined")
                                : t("common.status.noChange")}
                            </span>
                            <div className="text-xs text-gray-600 mt-1">
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
                          {trend.slice(0, 4).map((w: any) => (
                            <div key={w.id} className="p-3 rounded-lg border bg-gray-50">
                              <div className="text-xs text-gray-500">
                                {new Date(w.timeRangeStart).toLocaleDateString()} —{" "}
                                {new Date(w.timeRangeEnd).toLocaleDateString()}
                              </div>
                              <div className="text-sm font-medium">
                                {(w.grossSales || 0).toLocaleString()} SAR
                              </div>
                              <div className="text-xs text-gray-600">
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
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-base font-semibold">
                        {t("dashboard.insights.title")}
                      </div>
                      {!isPremium && (
                        <Link href="/pricing" className="text-xs text-isaudi-green">
                          {t("common.upgrade")}
                        </Link>
                      )}
                    </div>
                    {!isPremium ? (
                      <div className="relative">
                        <div className="opacity-30 select-none pointer-events-none">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-semibold mb-1">
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
                              <div className="font-semibold mb-1">
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
                          <div className="text-xs bg-white/80 backdrop-blur border rounded-md px-3 py-1">
                            {t("dashboard.insights.lock.message")}
                          </div>
                        </div>
                      </div>
                    ) : loadingInsights ? (
                      <div className="text-xs text-gray-500">
                        {t("dashboard.insights.loading")}
                      </div>
                    ) : insightsError ? (
                      <div className="text-xs text-gray-500">{insightsError}</div>
                    ) : insightsBlock ? (
                      <div className="space-y-4 text-xs text-gray-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold mb-1">
                            {t("dashboard.insights.keyHighlights")}
                            </div>
                            {Array.isArray(insightsBlock.insights) && insightsBlock.insights.length > 0 ? (
                              <ul className="list-disc pr-4 space-y-1">
                                {insightsBlock.insights.map((line: string, idx: number) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-gray-500">
                                {t("dashboard.insights.noHighlights")}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold mb-1">
                              {t("dashboard.insights.suggestedActions")}
                            </div>
                            {Array.isArray(insightsBlock.actionItems) && insightsBlock.actionItems.length > 0 ? (
                              <ul className="list-disc pr-4 space-y-1">
                                {insightsBlock.actionItems.map((line: string, idx: number) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-gray-500">
                                {t("dashboard.insights.noActions")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold mb-1">
                              {t("dashboard.insights.topProfitProducts")}
                            </div>
                            {Array.isArray(insightsBlock.topProfitProducts) && insightsBlock.topProfitProducts.length > 0 ? (
                              <ul className="space-y-1">
                                {insightsBlock.topProfitProducts.map((p: any, idx: number) => {
                                  const profitText = p.profitSar?.toLocaleString?.() ?? p.profitSar;
                                  const marginText = p.marginPct?.toFixed?.(2) ?? p.marginPct;
                                  const template = t("dashboard.insights.productProfitLine");
                                  const line = template
                                    .replace("{profit}", String(profitText))
                                    .replace("{margin}", String(marginText));
                                  return (
                                    <li key={idx}>
                                      <span className="font-semibold">{p.name}</span>
                                      {p.sku ? ` (SKU: ${p.sku})` : ""}{" "}
                                      {line}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="text-gray-500">
                                {t("dashboard.insights.notEnoughProfitData")}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold mb-1">
                              {t("dashboard.insights.lowMarginProducts")}
                            </div>
                            {Array.isArray(insightsBlock.lowMarginProducts) && insightsBlock.lowMarginProducts.length > 0 ? (
                              <ul className="space-y-1">
                                {insightsBlock.lowMarginProducts.map((p: any, idx: number) => {
                                  const profitText = p.profitSar?.toLocaleString?.() ?? p.profitSar;
                                  const marginText = p.marginPct?.toFixed?.(2) ?? p.marginPct;
                                  const template = t("dashboard.insights.productProfitLine");
                                  const line = template
                                    .replace("{profit}", String(profitText))
                                    .replace("{margin}", String(marginText));
                                  return (
                                    <li key={idx}>
                                      <span className="font-semibold">{p.name}</span>
                                      {p.sku ? ` (SKU: ${p.sku})` : ""}{" "}
                                      {line}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="text-gray-500">
                                {t("dashboard.insights.noLowMargin")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
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
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="text-sm">
                          {t("dashboard.freeBanner.text").replace(
                            "{count}",
                            String(Math.max(0, 2 - (user.freeReportsUsed || 0)))
                          )}
                        </div>
                        <div>
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

          </main>
        </div>
      </Container>
    </div>
  );
}
