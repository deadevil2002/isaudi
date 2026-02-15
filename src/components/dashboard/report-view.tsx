import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, DollarSign, Lightbulb } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

interface ReportViewProps {
  report: any;
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs */}
      {data.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">
                {t("dashboard.reportView.metrics.totalSales")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-isaudi-green">{(data.metrics.totalSales || 0).toLocaleString()} SAR</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">
                {t("dashboard.reportView.metrics.totalOrders")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.metrics.totalOrders || 0}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">
                {t("dashboard.reportView.metrics.avgOrderValue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(data.metrics.avgOrderValue || 0).toFixed(2)} SAR</div>
            </CardContent>
          </Card>
        </div>
      )}
      {data.metrics && (data.metrics.excludedOrdersCount > 0 || data.metrics.excludedSales > 0) && (
        <div className="text-xs text-gray-500">
          {t("dashboard.reportView.metrics.excluded")
            .replace("{orders}", String(data.metrics.excludedOrdersCount || 0))
            .replace("{amount}", (data.metrics.excludedSales || 0).toFixed(2))}
        </div>
      )}
      {/* Executive Summary */}
      <Card className="border-l-4 border-l-isaudi-green shadow-sm hover:shadow-md transition-all">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lightbulb className="w-6 h-6 text-isaudi-green" />
            {t("dashboard.reportView.executiveSummary.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed text-lg">
            {executiveSummary}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="shadow-sm hover:shadow-md transition-all group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-5 h-5" />
              {t("dashboard.reportView.topProducts.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(data.top_products || []).map((prod: any, i: number) => {
                const name =
                  typeof prod === "string"
                    ? prod
                    : prod.name || prod.sku || t("dashboard.reportView.topProducts.defaultName");
                const revenue =
                  typeof prod === "string"
                    ? ""
                    : (prod.revenue?.toFixed ? prod.revenue.toFixed(2) : prod.revenue || 0).toString();
                const qty = typeof prod === "string" ? "" : String(prod.qty || 0);
                const meta =
                  typeof prod === "string"
                    ? ""
                    : t("dashboard.reportView.topProducts.meta")
                        .replace("{revenue}", revenue)
                        .replace("{qty}", qty);
                return (
                <li key={i} className="flex items-start gap-2 bg-green-50/50 p-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                  <span className="text-gray-700 font-medium">{name}<span className="text-gray-500 text-xs">{meta}</span></span>
                </li>
              )})}
            </ul>
          </CardContent>
        </Card>

        {/* Weak Products */}
        <Card className="shadow-sm hover:shadow-md transition-all group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <TrendingDown className="w-5 h-5" />
              {t("dashboard.reportView.weakProducts.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(data.weak_products || []).map((prod: any, i: number) => {
                const name =
                  typeof prod === "string"
                    ? prod
                    : prod.name || prod.sku || t("dashboard.reportView.weakProducts.defaultName");
                const revenue =
                  typeof prod === "string"
                    ? ""
                    : (prod.revenue?.toFixed ? prod.revenue.toFixed(2) : prod.revenue || 0).toString();
                const qty = typeof prod === "string" ? "" : String(prod.qty || 0);
                const meta =
                  typeof prod === "string"
                    ? ""
                    : t("dashboard.reportView.weakProducts.meta")
                        .replace("{revenue}", revenue)
                        .replace("{qty}", qty);
                return (
                <li key={i} className="flex items-start gap-2 bg-red-50/50 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-1 shrink-0" />
                  <span className="text-gray-700 font-medium">{name}<span className="text-gray-500 text-xs">{meta}</span></span>
                </li>
              )})}
            </ul>
          </CardContent>
        </Card>
      </div>

      {profitability && (
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-gray-700">
                {t("dashboard.reportView.profitability.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.reportView.profitability.totalProfit")}
                  </div>
                  <div className="text-2xl font-bold text-isaudi-green">{(profitability.totalProfit || 0).toFixed(2)} SAR</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.reportView.profitability.margin")}
                  </div>
                  <div className="text-2xl font-bold">{(profitability.marginPct || 0).toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    {t("dashboard.reportView.profitability.incomplete")}
                  </div>
                  <div className="text-sm text-gray-600">
                    {profitability.missingCostProductsCount > 0
                      ? t("dashboard.reportView.profitability.incompleteSummary")
                          .replace("{products}", String(profitability.missingCostProductsCount))
                          .replace("{sales}", (profitability.missingCostSales || 0).toFixed(2))
                      : t("dashboard.reportView.profitability.none")}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    {t("dashboard.reportView.profitability.topProfit")}
                  </div>
                  <ul className="space-y-2">
                    {(profitability.topProfitProducts || []).map((p: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-center justify-between">
                        <span>{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                        <span className="text-isaudi-green">{(p.totalProfit || 0).toFixed(2)} SAR • {p.marginPct != null ? `${p.marginPct}%` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    {t("dashboard.reportView.profitability.worstMargins")}
                  </div>
                  <ul className="space-y-2">
                    {(profitability.lowMarginProducts || []).map((p: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-center justify-between">
                        <span>{p.name}{p.sku ? ` — ${p.sku}` : ''}</span>
                        <span className="text-red-500">{p.marginPct != null ? `${p.marginPct}%` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conversion Insights */}
        <Card className="bg-gradient-to-br from-white to-blue-50/30 shadow-sm hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-base text-blue-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t("dashboard.reportView.conversion.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversionList.length > 0 ? (
              <ul className="list-disc pr-5 space-y-1 text-sm text-gray-700">
                {conversionList.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            ) : (
              <p className="text-gray-600 text-sm">
                {t("dashboard.reportView.conversion.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pricing Suggestions */}
        <Card className="bg-gradient-to-br from-white to-yellow-50/30 shadow-sm hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-base text-yellow-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t("dashboard.reportView.pricing.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pricingList.length > 0 ? (
              <ul className="list-disc pr-5 space-y-1 text-sm text-gray-700">
                {pricingList.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            ) : (
              <p className="text-gray-600 text-sm">
                {t("dashboard.reportView.pricing.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Growth Opportunities */}
        <Card className="bg-gradient-to-br from-white to-purple-50/30 shadow-sm hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-base text-purple-700 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              {t("dashboard.reportView.growth.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {growthList.length > 0 ? (
              <ul className="space-y-2">
                {growthList.slice(0, 3).map((opp: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-purple-400">•</span>
                    {opp}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 text-sm">
                {t("dashboard.reportView.growth.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
