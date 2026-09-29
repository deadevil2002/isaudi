import { DashboardReviewClient } from "./review-client";

type PreviewLanguage = "ar" | "en";
type PlanState = "free" | "growth";
type StoreState = "connected" | "none";
type DataState = "populated" | "empty" | "error" | "loading";
type AnalysisState = "idle" | "loading" | "error" | "done";
type InsightsState = "populated" | "empty" | "error" | "loading";
type PreviewSection = "dashboard" | "reports" | "costs" | "connect" | "settings" | "billing" | "connections";
type DatasetState = "datasetA" | "datasetB";
type MotionState = "default" | "reduced";
type ComparisonState = "open" | "closed";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue<T extends string>(
  params: SearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function readText(params: SearchParams, key: string) {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim().slice(0, 120) ?? "";
}

function readDataset(params: SearchParams): DatasetState {
  const value = readText(params, "dataset");
  if (value === "b" || value === "datasetB") return "datasetB";
  return "datasetA";
}

export default async function DashboardReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const language = readValue<PreviewLanguage>(params, "lang", ["ar", "en"], "en");
  return (
    <>
      <DashboardReviewClient
        initialLanguage={language}
        initialSection={readValue<PreviewSection>(
          params,
          "section",
          ["dashboard", "reports", "costs", "connect", "settings", "billing", "connections"],
          "dashboard",
        )}
        initialPlan={readValue<PlanState>(params, "plan", ["free", "growth"], "growth")}
        initialStore={readValue<StoreState>(params, "store", ["connected", "none"], "connected")}
        initialData={readValue<DataState>(
          params,
          "data",
          ["populated", "empty", "error", "loading"],
          "populated",
        )}
        initialAnalysis={readValue<AnalysisState>(
          params,
          "analysis",
          ["idle", "loading", "error", "done"],
          "done",
        )}
        initialInsights={readValue<InsightsState>(
          params,
          "insights",
          ["populated", "empty", "error", "loading"],
          "populated",
        )}
        initialDataset={readDataset(params)}
        initialMotion={readValue<MotionState>(params, "motion", ["default", "reduced"], "default")}
        initialMessage={readText(params, "qaMessage")}
        initialSelectedReport={readText(params, "selectedReport")}
        initialComparison={readValue<ComparisonState>(params, "comparison", ["open", "closed"], "closed")}
        initialPhase3State={readText(params, "phase3State") || "default"}
      />
    </>
  );
}
