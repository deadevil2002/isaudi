import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import {
  formatReportComparison,
  type ComparisonState,
  type ReportComparison,
} from "@/lib/reports/comparison-format";
import { cn } from "@/lib/utils";

const stateStyles: Record<ComparisonState, string> = {
  improved: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]",
  declined: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]",
  unchanged: "border-[#ffffff1a] bg-[#1d252f] text-[#94a3b8]",
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
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
          stateStyles[formatted.state],
        )}
      >
        <StateIcon state={formatted.state} />
        <span>{formatted.statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {formatted.metrics.map((metric) => (
          <section
            key={metric.key}
            className={cn(
              "rounded-xl border p-4 text-start transition-colors",
              stateStyles[metric.state],
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <StateIcon state={metric.state} />
              <span>{metric.label}</span>
            </div>
            <p className="text-sm leading-6 opacity-90">{metric.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium opacity-80">
              <span>{metric.change}</span>
              {metric.rate && <span>{metric.rate}</span>}
            </div>
          </section>
        ))}
      </div>

      <p
        className={cn(
          "rounded-xl border px-4 py-4 text-sm leading-relaxed",
          stateStyles[formatted.state],
        )}
      >
        {formatted.interpretation}
      </p>
    </div>
  );
}
