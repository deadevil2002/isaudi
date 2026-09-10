import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import {
  formatReportComparison,
  type ComparisonState,
  type ReportComparison,
} from "@/lib/reports/comparison-format";
import { cn } from "@/lib/utils";

const stateStyles: Record<ComparisonState, string> = {
  improved: "border-green-200 bg-green-50/70 text-green-800",
  declined: "border-red-200 bg-red-50/70 text-red-800",
  unchanged: "border-gray-200 bg-gray-50 text-gray-700",
};

function StateIcon({ state }: { state: ComparisonState }) {
  if (state === "improved") return <TrendingUp className="h-4 w-4" aria-hidden="true" />;
  if (state === "declined") return <TrendingDown className="h-4 w-4" aria-hidden="true" />;
  return <Minus className="h-4 w-4" aria-hidden="true" />;
}

export function ReportComparisonDetails({
  comparison,
}: {
  comparison: ReportComparison;
}) {
  const { lang } = useLanguage();
  const formatted = formatReportComparison(comparison, lang);

  if (!formatted) return null;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
          stateStyles[formatted.state],
        )}
      >
        <StateIcon state={formatted.state} />
        <span>{formatted.statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {formatted.metrics.map((metric) => (
          <section
            key={metric.key}
            className={cn(
              "rounded-xl border p-3 text-start",
              stateStyles[metric.state],
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-bold">
              <StateIcon state={metric.state} />
              <span>{metric.label}</span>
            </div>
            <p className="text-sm leading-6">{metric.summary}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
              <span>{metric.change}</span>
              {metric.rate && <span>{metric.rate}</span>}
            </div>
          </section>
        ))}
      </div>

      <p
        className={cn(
          "rounded-xl border px-3 py-3 text-sm leading-6",
          stateStyles[formatted.state],
        )}
      >
        {formatted.interpretation}
      </p>
    </div>
  );
}