import { DashboardReviewClient } from "./review-client";

type PreviewLanguage = "ar" | "en";
type PlanState = "free" | "growth";
type StoreState = "connected" | "none";
type DataState = "populated" | "empty" | "error" | "loading";
type AnalysisState = "idle" | "loading" | "error" | "done";
type InsightsState = "populated" | "empty" | "error" | "loading";
type PreviewSection = "dashboard" | "reports" | "costs" | "connect";

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

export default async function DashboardReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const language = readValue<PreviewLanguage>(params, "lang", ["ar", "en"], "en");
  const direction = language === "ar" ? "rtl" : "ltr";

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang="${language}";document.documentElement.dir="${direction}";document.body.lang="${language}";document.body.dir="${direction}";`,
        }}
      />
      <DashboardReviewClient
        initialLanguage={language}
        initialSection={readValue<PreviewSection>(
          params,
          "section",
          ["dashboard", "reports", "costs", "connect"],
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
        initialMessage={readText(params, "qaMessage")}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function enhance(){var d=document.getElementById("authenticated-mobile-navigation");if(!d){setTimeout(enhance,0);return;}if(d.dataset.qaEnhanced)return;d.dataset.qaEnhanced="1";d.addEventListener("keydown",function(e){if(e.key!=="Tab"||!d.open)return;var items=Array.prototype.filter.call(d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),function(el){return el.getClientRects().length>0;});if(!items.length)return;var first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});document.addEventListener("pointerdown",function(e){if(!d.open)return;var r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();},true);window.addEventListener("resize",function(){if(window.innerWidth>=768&&d.open)d.close();});})();`,
        }}
      />
    </>
  );
}