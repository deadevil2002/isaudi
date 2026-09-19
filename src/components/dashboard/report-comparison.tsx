import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import {
  formatReportComparison,
  type ComparisonState,
  type ReportComparison,
} from "@/lib/reports/comparison-format";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/dashboard/animated-number";

const stateStyles: Record<ComparisonState, string> = {
  improved: "border-[#0fc9a7]/30 bg-[#0fc9a7]/10 text-[#0fc9a7]",
  declined: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]",
  unchanged: "border-[#ffffff1a] bg-[#161c24] text-[#94a3b8]",
};

const iconStyles: Record<ComparisonState, string> = {
  improved: "text-[#0fc9a7]",
  declined: "text-[#ef4444]",
  unchanged: "text-[#94a3b8]",
};

function StateIcon({ state, className }: { state: ComparisonState; className?: string }) {
  if (state === "improved") return <TrendingUp className={cn("h-4 w-4", className)} aria-hidden="true" />;
  if (state === "declined") return <TrendingDown className={cn("h-4 w-4", className)} aria-hidden="true" />;
  return <Minus className={cn("h-4 w-4", className)} aria-hidden="true" />;
}

export function ReportComparisonDetails({
  comparison,
}: {
  comparison: ReportComparison;
}) {
  const { lang } = useLanguage();
  const reducedMotion = useReducedMotion();
  const formatted = formatReportComparison(comparison, lang);

  if (!formatted || !comparison.previous) return null;

  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const currency = lang === "ar" ? "ر.س." : "SAR";
  const previous = comparison.previous;
  const rawMetrics = {
    sales: {
      previous: previous.sales,
      current: comparison.current.sales,
      format: (value: number) => `${numberFormat.format(value)} ${currency}`,
    },
    profit: {
      previous: previous.profit,
      current: comparison.current.profit,
      format: (value: number) => `${numberFormat.format(value)} ${currency}`,
    },
    margin: {
      previous: previous.marginPct,
      current: comparison.current.marginPct,
      format: (value: number) => `${numberFormat.format(value)}%`,
    },
    orders: {
      previous: previous.orders,
      current: comparison.current.orders,
      format: (value: number) => numberFormat.format(value),
    },
  };
  const dateRange = (start: number, end: number) =>
    `${new Date(start).toLocaleDateString(locale)} – ${new Date(end).toLocaleDateString(locale)}`;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-5 py-4 text-base font-bold shadow-sm",
          stateStyles[formatted.state],
        )}
      >
        <StateIcon state={formatted.state} className="w-5 h-5" />
        <span>{formatted.statusLabel}</span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[#ffffff1a] bg-[#0e1218] px-4 py-3 text-xs text-[#94a3b8]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" aria-hidden="true" />
          {dateRange(previous.timeRangeStart, previous.timeRangeEnd)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0fc9a7]" aria-hidden="true" />
          {dateRange(comparison.current.timeRangeStart, comparison.current.timeRangeEnd)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {formatted.metrics.map((metric) => {
          const raw = rawMetrics[metric.key];
          const maxValue = Math.max(Math.abs(raw.previous), Math.abs(raw.current), 1);
          const previousWidth = Math.abs(raw.previous) === 0 ? 0 : Math.max(4, (Math.abs(raw.previous) / maxValue) * 100);
          const currentWidth = Math.abs(raw.current) === 0 ? 0 : Math.max(4, (Math.abs(raw.current) / maxValue) * 100);

          return (
          <section
            key={metric.key}
            className={cn(
              "rounded-xl border p-5 text-start transition-colors",
              stateStyles[metric.state],
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <StateIcon state={metric.state} className={iconStyles[metric.state]} />
              <span className={iconStyles[metric.state]}>{metric.label}</span>
            </div>
            <p className={cn("text-sm leading-relaxed", metric.state === 'unchanged' ? 'text-[#94a3b8]' : 'text-white/90')}>{metric.summary}</p>
            <div className="mt-4 space-y-2" aria-label={metric.summary}>
              <div className="flex items-center gap-3">
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/20">
                  <motion.div
                    initial={false}
                    animate={{ width: `${previousWidth}%` }}
                    transition={{ duration: reducedMotion ? 0 : 0.7, ease: "easeOut" }}
                    className="h-full rounded-full bg-white/25"
                  />
                </div>
                <span className="w-24 shrink-0 text-end text-xs font-medium text-white/70">
                  <AnimatedNumber value={raw.previous} formatter={raw.format} duration={reducedMotion ? 0 : 0.7} />
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/20">
                  <motion.div
                    initial={false}
                    animate={{ width: `${currentWidth}%` }}
                    transition={{ duration: reducedMotion ? 0 : 0.85, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      raw.current < 0 ? "bg-[#ef4444]" : "bg-[#0fc9a7]",
                    )}
                  />
                </div>
                <span className="w-24 shrink-0 text-end text-xs font-bold text-white">
                  <AnimatedNumber value={raw.current} formatter={raw.format} duration={reducedMotion ? 0 : 0.85} />
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs font-bold">
              <span className={cn("px-2 py-1 rounded-md bg-black/20", iconStyles[metric.state])}>{metric.change}</span>
              {metric.rate && <span className={cn("px-2 py-1 rounded-md bg-black/20", iconStyles[metric.state])}>{metric.rate}</span>}
            </div>
          </section>
          );
        })}
      </div>

      <div
        className={cn(
          "rounded-xl border px-5 py-5 text-sm leading-relaxed bg-[#161c24] border-[#ffffff1a] shadow-sm relative overflow-hidden",
        )}
      >
        <div className={cn("absolute start-0 top-0 w-1 h-full",
          formatted.state === 'improved' ? 'bg-[#0fc9a7]' :
          formatted.state === 'declined' ? 'bg-[#ef4444]' : 'bg-[#e6b95c]'
        )} />
        <p className="text-[#f0f4f8]">
          {formatted.interpretation}
        </p>
      </div>
    </div>
  );
}