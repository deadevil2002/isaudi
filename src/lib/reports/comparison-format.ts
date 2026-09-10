import { createTranslator, type Lang } from "@/lib/i18n/translations";

export type ComparisonState = "improved" | "declined" | "unchanged";

export interface ReportComparison {
  current: {
    id: string;
    timeRangeStart: number;
    timeRangeEnd: number;
    sales: number;
    profit: number;
    marginPct: number;
    orders: number;
  };
  previous: {
    id: string;
    timeRangeStart: number;
    timeRangeEnd: number;
    sales: number;
    profit: number;
    marginPct: number;
    orders: number;
  } | null;
  deltas: {
    salesDeltaPct: number | null;
    profitDeltaPct: number | null;
    marginDeltaPct: number | null;
    ordersDelta: number | null;
  };
  status: "improved" | "declined" | "no_change";
}

export interface FormattedComparisonMetric {
  key: "sales" | "profit" | "margin" | "orders";
  label: string;
  state: ComparisonState;
  summary: string;
  change: string;
  rate?: string;
}

export interface FormattedReportComparison {
  state: ComparisonState;
  statusLabel: string;
  interpretation: string;
  metrics: FormattedComparisonMetric[];
}

function replaceTokens(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [token, value]) => result.replaceAll(`{${token}}`, value),
    template,
  );
}

function stateForDelta(delta: number): ComparisonState {
  if (delta > 0) return "improved";
  if (delta < 0) return "declined";
  return "unchanged";
}

export function formatReportComparison(
  comparison: ReportComparison,
  lang: Lang,
): FormattedReportComparison | null {
  if (!comparison.previous) return null;

  const t = createTranslator(lang);
  const numberFormat = new Intl.NumberFormat(
    lang === "ar" ? "ar-SA-u-nu-latn" : "en-US",
    { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  );
  const currency = t("common.currency.short");
  const previous = comparison.previous;
  const current = comparison.current;

  const amount = (value: number) => `${numberFormat.format(value)} ${currency}`;
  const percentage = (value: number) => `${numberFormat.format(value)}%`;
  const count = (value: number) => numberFormat.format(value);

  const makeMetric = ({
    key,
    label,
    previousValue,
    currentValue,
    formattedPrevious,
    formattedCurrent,
    formattedChange,
    deltaPercent,
  }: {
    key: FormattedComparisonMetric["key"];
    label: string;
    previousValue: number;
    currentValue: number;
    formattedPrevious: string;
    formattedCurrent: string;
    formattedChange: string;
    deltaPercent?: number | null;
  }): FormattedComparisonMetric => {
    const delta = currentValue - previousValue;
    const state = stateForDelta(delta);
    const stateKey =
      state === "improved" ? "increased" : state === "declined" ? "decreased" : "unchanged";
    const summary = replaceTokens(t(`reports.compare.${key}.${stateKey}`), {
      previous: formattedPrevious,
      current: formattedCurrent,
    });
    const change = replaceTokens(t(`reports.compare.change.${stateKey}`), {
      value: formattedChange,
    });
    const rate =
      deltaPercent == null
        ? undefined
        : replaceTokens(t(`reports.compare.rate.${stateKey}`), {
            value: percentage(Math.abs(deltaPercent)),
          });

    return { key, label, state, summary, change, rate };
  };

  const metrics: FormattedComparisonMetric[] = [
    makeMetric({
      key: "sales",
      label: t("reports.compare.sales"),
      previousValue: previous.sales,
      currentValue: current.sales,
      formattedPrevious: amount(previous.sales),
      formattedCurrent: amount(current.sales),
      formattedChange: amount(Math.abs(current.sales - previous.sales)),
      deltaPercent: comparison.deltas.salesDeltaPct,
    }),
    makeMetric({
      key: "profit",
      label: t("reports.compare.profit"),
      previousValue: previous.profit,
      currentValue: current.profit,
      formattedPrevious: amount(previous.profit),
      formattedCurrent: amount(current.profit),
      formattedChange: amount(Math.abs(current.profit - previous.profit)),
      deltaPercent: comparison.deltas.profitDeltaPct,
    }),
    makeMetric({
      key: "margin",
      label: t("reports.compare.margin"),
      previousValue: previous.marginPct,
      currentValue: current.marginPct,
      formattedPrevious: percentage(previous.marginPct),
      formattedCurrent: percentage(current.marginPct),
      formattedChange: replaceTokens(t("reports.compare.points"), {
        value: numberFormat.format(Math.abs(current.marginPct - previous.marginPct)),
      }),
      deltaPercent: null,
    }),
    makeMetric({
      key: "orders",
      label: t("reports.compare.orders"),
      previousValue: previous.orders,
      currentValue: current.orders,
      formattedPrevious: count(previous.orders),
      formattedCurrent: count(current.orders),
      formattedChange: count(Math.abs(current.orders - previous.orders)),
      deltaPercent: null,
    }),
  ];

  const state: ComparisonState =
    comparison.status === "improved"
      ? "improved"
      : comparison.status === "declined"
        ? "declined"
        : "unchanged";

  return {
    state,
    statusLabel: t(
      state === "improved"
        ? "common.status.improved"
        : state === "declined"
          ? "common.status.declined"
          : "common.status.noChange",
    ),
    interpretation: t(`reports.compare.interpretation.${state}`),
    metrics,
  };
}