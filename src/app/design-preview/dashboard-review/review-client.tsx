"use client";

import { useState } from "react";
import { LayoutDashboard, PieChart, ShoppingBag, TrendingUp } from "lucide-react";
import { DashboardClient } from "@/app/(authenticated)/dashboard/dashboard-client";
import CostsPage from "@/app/(authenticated)/dashboard/costs/page";
import { ReportsClient } from "@/app/(authenticated)/dashboard/reports/reports-client";
import { StoreSetup } from "@/components/dashboard/store-setup";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { MotionConfig } from "framer-motion";
import { LanguageProvider, useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import {
  fixtureCompareData,
  fixtureCompareDataB,
  fixtureCostsData,
  fixtureInsightsData,
  fixtureReport,
  fixtureReportB,
  fixtureTrendData,
  fixtureTrendDataB,
} from "./fixtures";

type PreviewLanguage = "ar" | "en";
type PlanState = "free" | "growth";
type StoreState = "connected" | "none";
type DataState = "populated" | "empty" | "error" | "loading";
type AnalysisState = "idle" | "loading" | "error" | "done";
type InsightsState = "populated" | "empty" | "error" | "loading";
type PreviewSection = "dashboard" | "reports" | "costs" | "connect";
type DatasetState = "datasetA" | "datasetB";
type MotionState = "default" | "reduced";
type ComparisonState = "open" | "closed";

interface DashboardReviewClientProps {
  initialLanguage: PreviewLanguage;
  initialSection: PreviewSection;
  initialPlan: PlanState;
  initialStore: StoreState;
  initialData: DataState;
  initialAnalysis: AnalysisState;
  initialInsights: InsightsState;
  initialDataset: DatasetState;
  initialMotion: MotionState;
  initialMessage: string;
  initialSelectedReport: string;
  initialComparison: ComparisonState;
}

function ReviewContent({
  initialSection,
  initialPlan,
  initialStore,
  initialData,
  initialAnalysis,
  initialInsights,
  initialDataset,
  initialMotion,
  initialMessage,
  initialSelectedReport,
  initialComparison,
}: Omit<DashboardReviewClientProps, "initialLanguage">) {
  const { lang, setLanguage } = useLanguage();
  const t = createTranslator(lang);
  const [section, setSection] = useState<PreviewSection>(initialSection);
  const [plan, setPlan] = useState<PlanState>(initialPlan);
  const [storeState, setStoreState] = useState<StoreState>(initialStore);
  const [dataState, setDataState] = useState<DataState>(initialData);
  const [analysisState, setAnalysisState] = useState<AnalysisState>(initialAnalysis);
  const [insightsState, setInsightsState] = useState<InsightsState>(initialInsights);
  const [dataset, setDataset] = useState<DatasetState>(initialDataset);
  const [motionPref, setMotionPref] = useState<MotionState>(initialMotion);

  const stateFields = {
    lang,
    section,
    plan,
    store: storeState,
    data: dataState,
    analysis: analysisState,
    insights: insightsState,
    dataset,
    motion: motionPref,
  };
  const previewHref = (nextSection: PreviewSection) => {
    const params = new URLSearchParams({ ...stateFields, section: nextSection });
    return `/design-preview/dashboard-review?${params.toString()}`;
  };
  const languageParams = new URLSearchParams({
    ...stateFields,
    lang: lang === "ar" ? "en" : "ar",
  });
  const previewLanguageHref = `/design-preview/dashboard-review?${languageParams.toString()}`;
  const selectClass =
    "w-full min-w-0 cursor-pointer rounded border border-white/20 bg-black p-1.5 outline-none focus:border-[#e6b95c] sm:w-auto";
  const populated = dataState === "populated";

  const currentTrendData = dataset === "datasetA" ? fixtureTrendData : fixtureTrendDataB;
  const currentCompareData = dataset === "datasetA" ? fixtureCompareData : fixtureCompareDataB;
  const currentReport = dataset === "datasetA" ? fixtureReport : fixtureReportB;
  const selectedReportId = currentTrendData.some((item) => item.id === initialSelectedReport)
    ? initialSelectedReport
    : currentTrendData[0]?.id;

  const report = { id: "report-1", ...currentReport };
  const previewTrend = populated
    ? currentTrendData.map((item) => ({
        ...item,
        timeRangeStart: new Date(item.timeRangeStart).toISOString(),
        timeRangeEnd: new Date(item.timeRangeEnd).toISOString(),
      }))
    : [];

  const initialMessages = initialMessage
    ? [
        { role: "assistant" as const, content: t("dashboard.chat.welcome") },
        { role: "user" as const, content: initialMessage },
        {
          role: "assistant" as const,
          content:
            lang === "ar"
              ? `هذا رد تجريبي محلي على: "${initialMessage}"`
              : `This is a local test response to: "${initialMessage}"`,
        },
      ]
    : undefined;

  const navItems = [
    { href: previewHref("dashboard"), label: t("dashboard.menu.dashboard"), icon: LayoutDashboard, active: section === "dashboard" },
    { href: previewHref("reports"), label: t("dashboard.menu.reports"), icon: PieChart, active: section === "reports" },
    { href: previewHref("costs"), label: t("dashboard.menu.costs"), icon: TrendingUp, active: section === "costs" },
    { href: previewHref("connect"), label: t("dashboard.menu.connectStore"), icon: ShoppingBag, active: section === "connect" },
  ];

  // We use MotionConfig to apply reduced-motion in preview without monkeypatching window.matchMedia.

  return (
    <MotionConfig reducedMotion={motionPref === "reduced" ? "always" : "user"}>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        data-reduced-motion={motionPref === "reduced" ? "true" : undefined}
      >
      <form
        action="/design-preview/dashboard-review"
        method="get"
        className="relative z-30 mt-16 flex min-h-[72px] flex-col items-center justify-between gap-4 border-b border-[#0fc9a7]/30 bg-[#06090c] px-4 py-3 text-white shadow-lg sm:mt-0 sm:flex-row"
        dir="ltr"
      >
        <div className="w-full min-w-0 break-words text-center text-sm font-bold text-[#e6b95c] sm:w-auto sm:text-start flex flex-col">
          <span>Visual QA Preview — Test Data</span>
          <span className="text-xs opacity-80 font-normal">معاينة بصرية للمستعرض — بيانات تجريبية</span>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-xs sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="qa-dataset">Dataset toggle</label>
          <select id="qa-dataset" className={selectClass} name="dataset" value={dataset} onChange={(event) => setDataset(event.target.value as DatasetState)}>
            <option value="datasetA">Dataset A</option>
            <option value="datasetB">Dataset B</option>
          </select>
          <label className="sr-only" htmlFor="qa-motion">Motion pref</label>
          <select id="qa-motion" className={selectClass} name="motion" value={motionPref} onChange={(event) => setMotionPref(event.target.value as MotionState)}>
            <option value="default">Default Motion</option>
            <option value="reduced">Reduced Motion</option>
          </select>
          <label className="sr-only" htmlFor="qa-language">Preview language</label>
          <select id="qa-language" className={selectClass} name="lang" value={lang} onChange={(event) => setLanguage(event.target.value as PreviewLanguage)}>
            <option value="en">English LTR</option>
            <option value="ar">Arabic RTL</option>
          </select>
          <label className="sr-only" htmlFor="qa-section">Preview section</label>
          <select id="qa-section" className={selectClass} name="section" value={section} onChange={(event) => setSection(event.target.value as PreviewSection)}>
            <option value="dashboard">Dashboard Overview</option>
            <option value="reports">Reports (Weekly)</option>
            <option value="costs">Costs Management</option>
            <option value="connect">Connect Store</option>
          </select>
          <label className="sr-only" htmlFor="qa-plan">Preview plan</label>
          <select id="qa-plan" className={selectClass} name="plan" value={plan} onChange={(event) => setPlan(event.target.value as PlanState)}>
            <option value="growth">Premium Plan</option>
            <option value="free">Free Plan</option>
          </select>
          <label className="sr-only" htmlFor="qa-store">Store state</label>
          <select id="qa-store" className={selectClass} name="store" value={storeState} onChange={(event) => setStoreState(event.target.value as StoreState)}>
            <option value="connected">Store Connected</option>
            <option value="none">No Store</option>
          </select>
          <label className="sr-only" htmlFor="qa-analysis">Analysis state</label>
          <select id="qa-analysis" className={selectClass} name="analysis" value={analysisState} onChange={(event) => setAnalysisState(event.target.value as AnalysisState)}>
            <option value="done">Analysis: Done</option>
            <option value="idle">Analysis: Idle</option>
            <option value="loading">Analysis: Loading</option>
            <option value="error">Analysis: Error</option>
          </select>
          <label className="sr-only" htmlFor="qa-data">Data state</label>
          <select id="qa-data" className={selectClass} name="data" value={dataState} onChange={(event) => setDataState(event.target.value as DataState)}>
            <option value="populated">Data: Populated</option>
            <option value="empty">Data: Empty</option>
            <option value="error">Data: Error</option>
            <option value="loading">Data: Loading</option>
          </select>
          <label className="sr-only" htmlFor="qa-insights">Insights state</label>
          <select id="qa-insights" className={selectClass} name="insights" value={insightsState} onChange={(event) => setInsightsState(event.target.value as InsightsState)}>
            <option value="populated">Insights: Populated</option>
            <option value="empty">Insights: Empty</option>
            <option value="error">Insights: Error</option>
            <option value="loading">Insights: Loading</option>
          </select>
          <button type="submit" className="col-span-2 min-h-9 rounded bg-[#e6b95c] px-3 py-1.5 font-bold text-black sm:col-span-1">
            Apply preview state
          </button>
        </div>
      </form>

      <AuthenticatedShell
        userEmail="qa@isaudi.ai"
        isPreview
        previewNavItems={navItems}
        previewHomeHref={previewHref("dashboard")}
        previewLanguageHref={previewLanguageHref}
      >
        {section === "dashboard" && (
          <DashboardClient
            user={{
              id: "qa-user",
              email: "qa@isaudi.ai",
              plan,
              planExpiresAt: null,
              createdAt: 1700000000000,
              freeReportsUsed: plan === "free" ? 2 : 0,
            }}
            stats={populated ? { products: dataset === 'datasetA' ? 450 : 500, orders: dataset === 'datasetA' ? 120 : 180, sales: dataset === 'datasetA' ? 1500000 : 2850000 } : { products: 0, orders: 0, sales: 0 }}
            storeConnection={storeState === "connected" ? { id: "qa-store" } : null}
            latestReport={storeState === "connected" && analysisState === "done" && populated ? report : null}
            previewProps={{
              dataState,
              trend: previewTrend,
              loadingTrend: dataState === "loading",
              compare: populated
                ? {
                    status: currentCompareData.status === "no_change" ? "noChange" : currentCompareData.status,
                    deltas: {
                      salesDeltaPct: currentCompareData.deltas.salesDeltaPct,
                      profitDeltaPct: currentCompareData.deltas.profitDeltaPct,
                      marginDeltaPct: currentCompareData.deltas.marginDeltaPct,
                    },
                  }
                : null,
              insightsBlock: insightsState === "populated" ? fixtureInsightsData : null,
              loadingInsights: insightsState === "loading",
              insightsError: insightsState === "error" ? "Simulated error loading insights." : null,
              freeReportsUsed: plan === "free" ? 2 : 0,
              analysisState: analysisState === "done" ? "idle" : analysisState,
              analysisError: "Simulated error generating report.",
              generateReport: async () => report,
              onUpgrade: () => undefined,
              chatSendMessage: async (message) =>
                lang === "ar"
                  ? `هذا رد تجريبي محلي على: "${message}"`
                  : `This is a local test response to: "${message}"`,
              chatInitialMessages: initialMessages,
              chatFallbackForm: {
                action: "/design-preview/dashboard-review",
                fields: stateFields,
                inputName: "qaMessage",
              },
              onConnectSalla: () => undefined,
              onUploadCsv: () => undefined,
              onNavigateCosts: (event) => event.preventDefault(),
              onNavigateBilling: (event) => event.preventDefault(),
            }}
          />
        )}
        {section === "reports" && (
          <ReportsClient
            key={`${selectedReportId}-${initialComparison}`}
            isFree={plan === "free"}
            previewProps={{
              rows: populated ? currentTrendData : [],
              loadState: dataState,
              compare: currentCompareData,
              compareLoadState: "populated",
              showComparisonForId: populated ? selectedReportId : undefined,
              compareExpanded: initialComparison === "open",
              selectionHrefBase: previewHref("reports"),
              actionHref: `${previewHref("reports")}#qa-shell-content`,
            }}
          />
        )}
        {section === "costs" && (
          <CostsPage
            previewProps={{
              rows: populated ? fixtureCostsData : [],
              loadState: dataState,
            }}
          />
        )}
        {section === "connect" && (
          <StoreSetup onConnectSalla={() => undefined} onUploadCsv={() => undefined} />
        )}
      </AuthenticatedShell>
    </div>
    </MotionConfig>
  );
}

export function DashboardReviewClient({
  initialLanguage,
  ...initialState
}: DashboardReviewClientProps) {
  return (
    <LanguageProvider initialLang={initialLanguage} localOnly>
      <ReviewContent {...initialState} />
    </LanguageProvider>
  );
}
