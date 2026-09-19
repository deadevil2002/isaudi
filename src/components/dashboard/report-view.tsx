import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, DollarSign, Lightbulb, Activity, Zap } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { InsightCard } from "@/components/dashboard/insight-card";

interface ReportViewProps {
  report: {
    reportJson: string;
    [key: string]: unknown;
  };
}

export function ReportView({ report }: ReportViewProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const data = JSON.parse(report.reportJson);
  const ai = data.aiNarrative || null;

  const executiveSummary =
    ai?.executiveSummary ||
    data.summary ||
    t("dashboard.reportView.executiveSummary.fallback");

  const conversionList: string[] = ai?.conversionInsights || (data.conversion_insight ? [data.conversion_insight] : []);
  const pricingList: string[] = ai?.pricingSuggestions || (data.pricing_suggestions ? [data.pricing_suggestions] : []);
  const growthList: string[] = ai?.growthOpportunities || data.growth_opportunities || [];
  const profitability = data.profitability || null;

  return (
    <div className="space-y-6">
      {/* Executive Summary as Hero Insight */}
      <InsightCard
        theme="gold"
        icon={<Lightbulb className="w-6 h-6" />}
        title={t("dashboard.reportView.executiveSummary.title")}
        content={<p className="text-lg leading-relaxed text-white/90">{executiveSummary}</p>}
      />

      {/* KPIs */}
      {data.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#161c24] border-[#ffffff1a] shadow-none hover:border-white/10 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-[#94a3b8]">
                {t("dashboard.reportView.metrics.totalSales")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#0fc9a7]">
                <AnimatedNumber value={data.metrics.totalSales || 0} formatter={(v) => `${v.toLocaleString()} SAR`} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#161c24] border-[#ffffff1a] shadow-none hover:border-white/10 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-[#94a3b8]">
                {t("dashboard.reportView.metrics.totalOrders")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber value={data.metrics.totalOrders || 0} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#161c24] border-[#ffffff1a] shadow-none hover:border-white/10 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-[#94a3b8]">
                {t("dashboard.reportView.metrics.avgOrderValue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                <AnimatedNumber value={data.metrics.avgOrderValue || 0} formatter={(v) => `${v.toFixed(2)} SAR`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {data.metrics && (data.metrics.excludedOrdersCount > 0 || data.metrics.excludedSales > 0) && (
        <div className="text-xs text-[#64748b]">
          {t("dashboard.reportView.metrics.excluded")
            .replace("{orders}", String(data.metrics.excludedOrdersCount || 0))
            .replace("{amount}", (data.metrics.excludedSales || 0).toFixed(2))}
        </div>
      )}

      {/* Top and Weak Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InsightCard
          theme="teal"
          icon={<TrendingUp className="w-5 h-5" />}
          title={t("dashboard.reportView.topProducts.title")}
          content={
            <ul className="space-y-3">
              {(data.top_products || []).map((prod: string | { name?: string; sku?: string; revenue?: number; qty?: number }, i: number) => {
                const name = typeof prod === "string" ? prod : prod.name || prod.sku || t("dashboard.reportView.topProducts.defaultName");
                const revenue = typeof prod === "string" ? "" : (prod.revenue?.toFixed ? prod.revenue.toFixed(2) : prod.revenue || 0).toString();
                const qty = typeof prod === "string" ? "" : String(prod.qty || 0);
                const meta = typeof prod === "string" ? "" : t("dashboard.reportView.topProducts.meta").replace("{revenue}", revenue).replace("{qty}", qty);
                return (
                  <li key={i} className="flex items-start gap-3 bg-[#ffffff0a] p-3 rounded-xl border border-[#ffffff0a]">
                    <CheckCircle2 className="w-4 h-4 text-[#0fc9a7] mt-1 shrink-0" />
                    <div>
                      <div className="text-white font-medium break-words">{name}</div>
                      {meta && <div className="text-[#0fc9a7] text-xs mt-1">{meta}</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
          }
        />

        <InsightCard
          theme="red"
          icon={<TrendingDown className="w-5 h-5" />}
          title={t("dashboard.reportView.weakProducts.title")}
          content={
            <ul className="space-y-3">
              {(data.weak_products || []).map((prod: string | { name?: string; sku?: string; revenue?: number; qty?: number }, i: number) => {
                const name = typeof prod === "string" ? prod : prod.name || prod.sku || t("dashboard.reportView.weakProducts.defaultName");
                const revenue = typeof prod === "string" ? "" : (prod.revenue?.toFixed ? prod.revenue.toFixed(2) : prod.revenue || 0).toString();
                const qty = typeof prod === "string" ? "" : String(prod.qty || 0);
                const meta = typeof prod === "string" ? "" : t("dashboard.reportView.weakProducts.meta").replace("{revenue}", revenue).replace("{qty}", qty);
                return (
                  <li key={i} className="flex items-start gap-3 bg-[#ffffff0a] p-3 rounded-xl border border-[#ffffff0a]">
                    <AlertCircle className="w-4 h-4 text-[#ef4444] mt-1 shrink-0" />
                    <div>
                      <div className="text-white font-medium break-words">{name}</div>
                      {meta && <div className="text-[#ef4444] text-xs mt-1">{meta}</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
          }
        />
      </div>

      {profitability && (
        <Card className="bg-[#161c24] border-[#ffffff1a] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl text-white">
              {t("dashboard.reportView.profitability.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a]">
                <div className="text-sm text-[#94a3b8] mb-1">{t("dashboard.reportView.profitability.totalProfit")}</div>
                <div className="text-2xl font-bold text-[#0fc9a7]">
                  <AnimatedNumber value={profitability.totalProfit || 0} formatter={(v) => `${v.toFixed(2)} SAR`} />
                </div>
              </div>
              <div className="bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a]">
                <div className="text-sm text-[#94a3b8] mb-1">{t("dashboard.reportView.profitability.margin")}</div>
                <div className="text-2xl font-bold text-white">
                  <AnimatedNumber value={profitability.marginPct || 0} formatter={(v) => `${v.toFixed(2)}%`} />
                </div>
              </div>
              <div className="bg-[#0e1218] p-5 rounded-2xl border border-[#ffffff1a] flex flex-col justify-center">
                <div className="text-sm text-[#94a3b8] mb-1">{t("dashboard.reportView.profitability.incomplete")}</div>
                <div className="text-sm text-[#e6b95c] font-medium">
                  {profitability.missingCostProductsCount > 0
                    ? t("dashboard.reportView.profitability.incompleteSummary")
                        .replace("{products}", String(profitability.missingCostProductsCount))
                        .replace("{sales}", (profitability.missingCostSales || 0).toFixed(2))
                    : t("dashboard.reportView.profitability.none")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-bold text-white mb-3 uppercase tracking-wider">{t("dashboard.reportView.profitability.topProfit")}</div>
                <ul className="space-y-2">
                  {(profitability.topProfitProducts || []).map((p: { name: string; sku?: string; totalProfit?: number; marginPct?: number }, i: number) => (
                    <li key={i} className="text-sm bg-[#ffffff0a] p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 border border-[#ffffff0a]">
                      <span className="truncate text-white font-medium">{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                      <span className="text-[#0fc9a7] font-bold whitespace-nowrap">{(p.totalProfit || 0).toFixed(2)} SAR • {p.marginPct != null ? `${p.marginPct}%` : '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-3 uppercase tracking-wider">{t("dashboard.reportView.profitability.worstMargins")}</div>
                <ul className="space-y-2">
                  {(profitability.lowMarginProducts || []).map((p: { name: string; sku?: string; marginPct?: number }, i: number) => (
                    <li key={i} className="text-sm bg-[#ffffff0a] p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 border border-[#ffffff0a]">
                      <span className="truncate text-white font-medium">{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                      <span className="text-[#ef4444] font-bold whitespace-nowrap">{p.marginPct != null ? `${p.marginPct}%` : '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InsightCard
          theme="teal"
          icon={<Activity className="w-5 h-5" />}
          title={t("dashboard.reportView.conversion.title")}
          content={
            conversionList.length > 0 ? (
              <ul className="list-disc pr-5 pl-1 space-y-2 text-sm text-white/90">
                {conversionList.map((item, i) => <li key={i} className="leading-relaxed">{item}</li>)}
              </ul>
            ) : <p className="text-[#64748b] text-sm">{t("dashboard.reportView.conversion.noData")}</p>
          }
        />

        <InsightCard
          theme="gold"
          icon={<DollarSign className="w-5 h-5" />}
          title={t("dashboard.reportView.pricing.title")}
          content={
            pricingList.length > 0 ? (
              <ul className="list-disc pr-5 pl-1 space-y-2 text-sm text-white/90">
                {pricingList.map((item, i) => <li key={i} className="leading-relaxed">{item}</li>)}
              </ul>
            ) : <p className="text-[#64748b] text-sm">{t("dashboard.reportView.pricing.noData")}</p>
          }
        />

        <InsightCard
          theme="default"
          icon={<Zap className="w-5 h-5" />}
          title={t("dashboard.reportView.growth.title")}
          content={
            growthList.length > 0 ? (
              <ul className="space-y-3">
                {growthList.map((opp: string, i: number) => (
                  <li key={i} className="text-sm text-white/80 flex items-start gap-2 bg-[#ffffff0a] p-3 rounded-lg">
                    <span className="text-[#e6b95c] mt-1 shrink-0">•</span>
                    <span className="leading-relaxed">{opp}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[#64748b] text-sm">{t("dashboard.reportView.growth.noData")}</p>
          }
        />
      </div>
    </div>
  );
}