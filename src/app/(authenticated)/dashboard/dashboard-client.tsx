"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreSetup } from '@/components/dashboard/store-setup';
import { GenerateAnalysis } from '@/components/dashboard/generate-analysis';
import { ChatPanel, type ChatSendResult } from '@/components/dashboard/chat-panel';
import { createTranslator } from "@/lib/i18n/translations";
import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { InsightCard } from '@/components/dashboard/insight-card';
import { Skeleton } from '@/components/dashboard/skeleton';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ChevronDown,
  CircleCheck,
  Gauge,
  Lightbulb,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { parseReportViewData, type ReportViewData } from '@/lib/dashboard/report-view-data';

function ReportDetailsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}

const DeferredReportView = dynamic(
  () => import('./deferred-report-view').then((module) => module.DeferredReportView),
  { loading: () => <ReportDetailsSkeleton /> },
);

type DashboardUser = {
  id: string;
  email: string;
  plan: string;
  planExpiresAt?: number | null;
  createdAt?: number;
  freeReportsUsed?: number;
};

type DashboardReport = {
  id: string;
  data?: ReportViewData;
  reportJson?: string;
  [key: string]: unknown;
};

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
  chatSendMessage?: (message: string, reportId: string) => Promise<ChatSendResult>;
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
  storeConnected,
  latestReport,
  previewProps
}: {
  user: DashboardUser;
  stats?: { products: number; orders: number; sales: number; excludedOrdersCount?: number; excludedSalesHalala?: number } | null;
  storeConnected?: boolean;
  latestReport?: DashboardReport | null;
  previewProps?: DashboardPreviewProps;
}) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [report, setReport] = useState<DashboardReport | null | undefined>(latestReport);
  const [trend, setTrend] = useState<TrendSnapshot[]>(previewProps?.trend || []);
  const [compare, setCompare] = useState<CompareData | null>(previewProps?.compare || null);
  const [loadingTrend, setLoadingTrend] = useState(previewProps?.loadingTrend || false);
  const isDev = previewProps && previewProps.isDev !== undefined ? previewProps.isDev : (!previewProps && process.env.NODE_ENV === 'development');
  const [insightsBlock, setInsightsBlock] = useState<InsightsBlock | null>(previewProps?.insightsBlock || null);
  const [loadingInsights, setLoadingInsights] = useState(previewProps?.loadingInsights || false);
  const [insightsError, setInsightsError] = useState<string | null>(previewProps?.insightsError || null);
  const [requestedReportId, setRequestedReportId] = useState<string | null>(
    latestReport?.data || latestReport?.reportJson ? latestReport.id : null,
  );
  const [reportLoadState, setReportLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reportRequestAttempt, setReportRequestAttempt] = useState(0);
  const [trendWindow, setTrendWindow] = useState<4 | 8 | 12>(12);
  const [activeKpi, setActiveKpi] = useState<'products' | 'orders' | 'sales' | 'margin' | null>(null);
  const reportDetailsRef = useRef<HTMLDivElement>(null);
  const parsedReport = useMemo(() => {
    if (report?.data) return report.data;
    return report?.reportJson ? parseReportViewData(report.reportJson) : null;
  }, [report]);
  const missingCosts = parsedReport?.profitability?.missingCostProductsCount || 0;

  const isPremium = user.plan !== 'free';

  const userWithFreeReports = user as typeof user & { freeReportsUsed?: number };
  const actualFreeReportsUsed = previewProps?.freeReportsUsed ?? userWithFreeReports.freeReportsUsed ?? 0;
  const previewDataState = previewProps?.dataState;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReport((current) => {
        const currentHasDetails = Boolean(current?.data || current?.reportJson);
        return current?.id === latestReport?.id && currentHasDetails ? current : latestReport;
      });
    }, 0);
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
  const reportDateLocale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
  const formatReportDate = (value: string) => new Date(value).toLocaleDateString(
    reportDateLocale,
    { timeZone: 'Asia/Riyadh' },
  );

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
  const dashboardCopy = lang === 'ar' ? {
    overview: 'نظرة المتجر', connected: 'متصل', disconnected: 'غير متصل',
    currentPeriod: 'الفترة الحالية', weeks: 'أسابيع', details: 'عرض التفاصيل',
    closeDetails: 'إغلاق التفاصيل', productIntelligence: 'ذكاء المنتجات',
    productIntelligenceHint: 'مؤشرات مبنية على آخر تقرير مكتمل', topPerformance: 'أفضل أداء',
    needsAttention: 'يحتاج انتباه', stable: 'مستقر', noProductData: 'لا توجد بيانات منتجات كافية بعد.',
    actualData: 'هذه التفاصيل من بيانات متجرك المسجلة.', reportsCta: 'فتح التقارير',
    advisorRegion: 'مستشار المتجر', margin: 'هامش الربح', averageOrder: 'متوسط الطلب',
    salesContext: 'إجمالي المبيعات المسجلة في التقرير الحالي.',
    ordersContext: 'إجمالي الطلبات المؤهلة للتحليل.',
    productsContext: 'عدد المنتجات المخزنة لهذا الحساب.',
    marginContext: 'الهامش المحسوب من تكاليف المنتجات المتاحة فقط.',
  } : {
    overview: 'Store overview', connected: 'Connected', disconnected: 'Disconnected',
    currentPeriod: 'Current period', weeks: 'weeks', details: 'View details',
    closeDetails: 'Close details', productIntelligence: 'Product intelligence',
    productIntelligenceHint: 'Signals from the latest completed report', topPerformance: 'Top performance',
    needsAttention: 'Needs attention', stable: 'Stable', noProductData: 'There is not enough product data yet.',
    actualData: 'These details come from your recorded store data.', reportsCta: 'Open reports',
    advisorRegion: 'Store consultant', margin: 'Profit margin', averageOrder: 'Average order',
    salesContext: 'Total sales recorded in the current report.',
    ordersContext: 'Total orders eligible for analysis.',
    productsContext: 'Products stored for this account.',
    marginContext: 'Margin calculated only from products with available costs.',
  };
  const visibleTrend = trend.slice(0, trendWindow);

  const showSetup = !storeConnected;
  const showGenerate = storeConnected && !report;
  const showReport = !!report;

  useEffect(() => {
    const reportId = report?.id;
    if (
      previewProps ||
      !reportId ||
      parsedReport ||
      requestedReportId === reportId
    ) {
      return;
    }

    const target = reportDetailsRef.current;
    if (!target || typeof window.IntersectionObserver !== 'function') {
      setRequestedReportId(reportId);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequestedReportId(reportId);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [parsedReport, previewProps, report?.id, requestedReportId]);

  useEffect(() => {
    const reportId = report?.id;
    if (
      previewProps ||
      !reportId ||
      parsedReport ||
      requestedReportId !== reportId
    ) {
      return;
    }

    const controller = new AbortController();
    setReportLoadState('loading');
    void fetch(`/api/reports/detail?reportId=${encodeURIComponent(reportId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load report details');
        return response.json() as Promise<{ report?: DashboardReport }>;
      })
      .then((payload) => {
        if (!payload.report || payload.report.id !== reportId) {
          throw new Error('Invalid report details');
        }
        setReport((current) => current?.id === reportId ? payload.report : current);
        setReportLoadState('idle');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setReportLoadState('error');
      });

    return () => controller.abort();
  }, [parsedReport, previewProps, report?.id, reportRequestAttempt, requestedReportId]);

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
    <div className="space-y-6 text-[#f0f4f8]">
      <div className={showReport ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" : "min-w-0"} dir="ltr">
        <div className="min-w-0 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="isaudi-card isaudi-hero-surface p-5 sm:p-7" aria-labelledby="dashboard-overview-title">
        <div className="pointer-events-none absolute inset-y-0 end-0 w-2/3 bg-[radial-gradient(circle_at_70%_25%,rgba(230,185,92,.2),transparent_38%),radial-gradient(circle_at_85%_85%,rgba(32,212,178,.12),transparent_38%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="isaudi-eyebrow">{dashboardCopy.overview}</span>
              <span className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold ${storeConnected ? 'border-[#20d4b2]/25 bg-[#20d4b2]/10 text-[#72ead4]' : 'border-white/10 bg-white/[.04] text-[#a4b0c0]'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${storeConnected ? 'bg-[#20d4b2]' : 'bg-[#728196]'}`} aria-hidden="true" />
                {storeConnected ? dashboardCopy.connected : dashboardCopy.disconnected}
              </span>
            </div>
            <h1 id="dashboard-overview-title" className="max-w-3xl break-words text-2xl font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-3xl lg:text-[2rem]">
              {t("dashboard.welcomeLine").replace("{email}", user.email)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#a4b0c0]">
              {isPremium ? t("dashboard.plan.premiumDesc") : t("dashboard.plan.upgradeDesc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
              <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#728196]">{t("dashboard.plan.label")}</div>
              <div className="mt-1 text-lg font-bold capitalize text-[#f3ce7c]">{planName}</div>
            </div>
            <Link href={previewProps ? "#" : "/billing"} onClick={previewProps?.onNavigateBilling ? (e) => { e.preventDefault(); previewProps.onNavigateBilling!(e); } : previewProps ? (e) => e.preventDefault() : undefined}>
              <Button className="isaudi-primary-action min-h-12 rounded-2xl px-5 font-bold">
                {isPremium ? t("dashboard.plan.manage") : t("dashboard.plan.upgrade")}
                <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

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

      {/* Stats Overview */}
      {hasData && storeConnected && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              {
                id: 'sales' as const,
                label: t("dashboard.stats.salesLabel"),
                note: t("dashboard.stats.salesNote"),
                value: parsedReport?.metrics?.totalSales ?? (stats.sales / 100),
                formatter: (value: number) => `${value.toLocaleString()} SAR`,
                icon: WalletCards,
                tone: 'teal',
                detail: dashboardCopy.salesContext,
              },
              {
                id: 'orders' as const,
                label: t("dashboard.stats.ordersLabel"),
                note: t("dashboard.stats.ordersNote"),
                value: parsedReport?.metrics?.totalOrders ?? stats.orders,
                icon: ShoppingCart,
                tone: 'default',
                detail: dashboardCopy.ordersContext,
              },
              {
                id: 'margin' as const,
                label: parsedReport?.profitability?.marginPct != null ? dashboardCopy.margin : dashboardCopy.averageOrder,
                note: dashboardCopy.currentPeriod,
                value: parsedReport?.profitability?.marginPct ?? parsedReport?.metrics?.avgOrderValue ?? 0,
                formatter: (value: number) => parsedReport?.profitability?.marginPct != null ? `${value.toFixed(1)}%` : `${value.toFixed(2)} SAR`,
                icon: Gauge,
                tone: 'gold',
                detail: parsedReport?.profitability?.marginPct != null ? dashboardCopy.marginContext : dashboardCopy.actualData,
              },
              {
                id: 'products' as const,
                label: t("dashboard.stats.productsLabel"),
                note: t("dashboard.stats.productsNote"),
                value: stats.products,
                icon: Package,
                tone: 'gold',
                detail: dashboardCopy.productsContext,
              },
            ]).map((item) => {
              const Icon = item.icon;
              const expanded = activeKpi === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="dashboard-kpi-detail"
                  onClick={() => setActiveKpi((current) => current === item.id ? null : item.id)}
                  className={`isaudi-card isaudi-card-interactive isaudi-focus group min-w-0 p-4 text-start sm:p-5 ${expanded ? 'border-[#e6b95c]/35 shadow-[0_22px_60px_rgba(0,0,0,.36),0_0_0_1px_rgba(230,185,92,.08)]' : ''}`}
                >
                  <div className="mb-5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-5 text-[#b4bfcc] sm:text-sm">{item.label}</div>
                      <div className="mt-0.5 truncate text-[10px] text-[#728196] sm:text-xs">{item.note}</div>
                    </div>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${item.tone === 'teal' ? 'border-[#20d4b2]/20 bg-[#20d4b2]/10 text-[#20d4b2]' : item.tone === 'gold' ? 'border-[#e6b95c]/20 bg-[#e6b95c]/10 text-[#e6b95c]' : 'border-white/10 bg-white/[.04] text-white'}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className={`isaudi-data-number break-words text-2xl font-bold sm:text-3xl ${item.tone === 'teal' ? 'text-[#20d4b2]' : 'text-white'}`}>
                    <AnimatedNumber value={item.value} formatter={item.formatter} />
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8290a2] transition-colors group-hover:text-[#d9e0e8]">
                    {expanded ? dashboardCopy.closeDetails : dashboardCopy.details}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>

          {activeKpi && (
            <div id="dashboard-kpi-detail" role="status" className="isaudi-inset-panel flex flex-col gap-3 p-4 text-sm text-[#b8c3cf] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#20d4b2]" aria-hidden="true" />
                <p className="leading-6">{({
                  products: dashboardCopy.productsContext,
                  orders: dashboardCopy.ordersContext,
                  sales: dashboardCopy.salesContext,
                  margin: parsedReport?.profitability?.marginPct != null ? dashboardCopy.marginContext : dashboardCopy.actualData,
                })[activeKpi]}</p>
              </div>
              <Link className="isaudi-focus inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-white/10 px-3 font-semibold text-white transition hover:border-[#e6b95c]/30 hover:bg-[#e6b95c]/[.06]" href={previewProps ? '#' : '/dashboard/reports'} onClick={previewProps ? (event) => event.preventDefault() : undefined}>
                {dashboardCopy.reportsCta}
              </Link>
            </div>
          )}

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
            <div className="isaudi-card p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#e6b95c]/20 bg-[#e6b95c]/10 text-[#e6b95c]">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-lg font-bold text-white sm:text-xl">{t("dashboard.trend.title")}</div>
                    <p className="mt-1 text-xs text-[#728196]">{dashboardCopy.actualData}</p>
                  </div>
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
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="isaudi-focus inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-[#a4b0c0] transition hover:border-white/20 hover:bg-white/[.04] hover:text-white disabled:cursor-wait disabled:opacity-60"
                      disabled={loadingTrend}
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
                      <CalendarRange className="h-4 w-4" aria-hidden="true" />
                      {loadingTrend ? t("dashboard.trend.refresh.loading") : t("dashboard.trend.refresh")}
                    </button>

                    {trend.length > 0 && (
                      <div className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-black/15 p-1" aria-label={dashboardCopy.currentPeriod}>
                        {([4, 8, 12] as const).map((weeks) => (
                          <button
                            key={weeks}
                            type="button"
                            aria-pressed={trendWindow === weeks}
                            onClick={() => setTrendWindow(weeks)}
                            className={`isaudi-focus min-h-8 rounded-lg px-2.5 text-xs font-semibold transition ${trendWindow === weeks ? 'bg-[#e6b95c] text-[#171004] shadow-[0_6px_16px_rgba(230,185,92,.16)]' : 'text-[#8290a2] hover:text-white'}`}
                          >
                            {weeks} {dashboardCopy.weeks}
                          </button>
                        ))}
                      </div>
                    )}

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
                  ) : visibleTrend.length > 0 ? (
                    <div className="pt-4 pb-2">
                      <TrendChart data={visibleTrend} />
                    </div>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-[#64748b] border border-[#ffffff1a] border-dashed rounded-xl">
                      {t("dashboard.trend.lock.metrics")} {/* fallback text */}
                    </div>
                  )}

                  {visibleTrend.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      {visibleTrend.slice(0, 4).map((w: TrendSnapshot) => (
                        <div key={w.id} className="isaudi-inset-panel p-4 transition-colors hover:border-white/15">
                          <div className="text-xs text-[#94a3b8] mb-1">
                            {formatReportDate(w.timeRangeStart)} — {formatReportDate(w.timeRangeEnd)}
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

          {(parsedReport?.top_products?.length || parsedReport?.weak_products?.length) ? (
            <section className="isaudi-card p-5 sm:p-7" aria-labelledby="product-intelligence-title">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#20d4b2]/20 bg-[#20d4b2]/10 text-[#20d4b2]">
                      <Package className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 id="product-intelligence-title" className="text-lg font-bold text-white sm:text-xl">{dashboardCopy.productIntelligence}</h2>
                  </div>
                  <p className="text-xs leading-5 text-[#728196]">{dashboardCopy.productIntelligenceHint}</p>
                </div>
                <Link href={previewProps ? '#' : '/dashboard/reports'} onClick={previewProps ? (event) => event.preventDefault() : undefined} className="isaudi-focus inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#b8c3cf] transition hover:border-[#e6b95c]/30 hover:text-white sm:self-auto">
                  {dashboardCopy.reportsCta}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {([
                  ...((parsedReport.top_products || []).slice(0, 3).map((product) => ({ product, status: dashboardCopy.topPerformance, tone: 'teal' as const }))),
                  ...((parsedReport.weak_products || []).slice(0, 3).map((product) => ({ product, status: dashboardCopy.needsAttention, tone: 'gold' as const }))),
                ]).map(({ product, status, tone }, index) => {
                  const productData = typeof product === 'string' ? null : product;
                  const name = typeof product === 'string' ? product : product.name || product.sku || t("dashboard.reportView.topProducts.defaultName");
                  const rowClass = "isaudi-inset-panel min-w-0 px-4 py-3";
                  const body = (
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white" title={name}>{name}</div>
                        {productData?.sku && <div className="mt-1 truncate font-mono text-[10px] text-[#728196]">{productData.sku}</div>}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone === 'teal' ? 'border-[#20d4b2]/20 bg-[#20d4b2]/10 text-[#72ead4]' : 'border-[#e6b95c]/20 bg-[#e6b95c]/10 text-[#f3ce7c]'}`}>{status}</span>
                    </div>
                  );
                  if (!productData) return <div key={`${name}-${index}`} className={rowClass}>{body}</div>;
                  return (
                    <details key={`${name}-${index}`} className={`${rowClass} group open:border-[#e6b95c]/20`}>
                      <summary className="isaudi-focus min-h-9 cursor-pointer list-none rounded-lg">{body}</summary>
                      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[.07] pt-3 text-xs">
                        <div><dt className="text-[#728196]">{t("common.sales")}</dt><dd className="mt-1 font-semibold text-white">{productData.revenue == null ? '—' : `${productData.revenue.toLocaleString()} SAR`}</dd></div>
                        <div><dt className="text-[#728196]">{t("dashboard.stats.ordersLabel")}</dt><dd className="mt-1 font-semibold text-white">{productData.qty ?? '—'}</dd></div>
                        <div><dt className="text-[#728196]">{t("common.profit")}</dt><dd className="mt-1 font-semibold text-[#72ead4]">{productData.totalProfit == null && productData.profitSar == null ? '—' : `${(productData.totalProfit ?? productData.profitSar ?? 0).toLocaleString()} SAR`}</dd></div>
                        <div><dt className="text-[#728196]">{dashboardCopy.margin}</dt><dd className="mt-1 font-semibold text-white">{productData.marginPct == null ? '—' : `${productData.marginPct.toFixed(1)}%`}</dd></div>
                      </dl>
                    </details>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="mt-4">
            <div className="isaudi-card p-5 sm:p-7">
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
        <div className="space-y-6">
          {!isPremium && (
            <div>
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
          <div
            ref={reportDetailsRef}
            className="min-h-[32rem]"
            aria-busy={!parsedReport && reportLoadState !== 'error'}
          >
            {!parsedReport && reportLoadState !== 'error' && (
              <span className="sr-only">{t("reports.loading")}</span>
            )}
            {parsedReport ? (
              <DeferredReportView data={parsedReport} />
            ) : reportLoadState === 'error' ? (
              <div className="flex min-h-[32rem] flex-col items-center justify-center gap-4 rounded-3xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-8 text-center">
                <p className="text-sm font-medium text-[#ef4444]">{t("reports.error")}</p>
                <Button
                  variant="outline"
                  onClick={() => setReportRequestAttempt((attempt) => attempt + 1)}
                  className="rounded-full border-white/20 text-white"
                >
                  {t("reports.retry")}
                </Button>
              </div>
            ) : (
              <ReportDetailsSkeleton />
            )}
          </div>
        </div>
      ) : null}
        </div>

        {showReport && report && (
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={dashboardCopy.advisorRegion}>
            <ChatPanel
              reportId={report.id}
              freeReportsUsed={actualFreeReportsUsed}
              isPremium={isPremium}
              sendMessage={previewProps?.chatSendMessage}
              initialMessages={previewProps?.chatInitialMessages}
              fallbackForm={previewProps?.chatFallbackForm}
              blockedActionHref={previewProps?.onNavigateBilling ? "#" : undefined}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
