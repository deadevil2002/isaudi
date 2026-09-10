import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateAnnualSavingsPercent,
  calculateMinimumAnnualSavingsPercent,
} from "../src/lib/pricing/annual-savings";
import {
  formatReportComparison,
  type ReportComparison,
} from "../src/lib/reports/comparison-format";
import { t } from "../src/lib/i18n/translations";
import { getLoadViewState } from "../src/lib/ui/load-state";

test("annual savings are calculated from configured monthly and yearly prices", () => {
  assert.equal(calculateAnnualSavingsPercent(199, 1999), 16);
  assert.equal(calculateAnnualSavingsPercent(399, 3999), 16);
  assert.equal(calculateAnnualSavingsPercent(899, 8999), 17);
  assert.equal(
    calculateMinimumAnnualSavingsPercent([
      { priceMonthly: 199, priceYearly: 1999 },
      { priceMonthly: 399, priceYearly: 3999 },
      { priceMonthly: 899, priceYearly: 8999 },
    ]),
    16,
  );
});

test("mobile navigation keys have complete Arabic and English translations", () => {
  const expected = {
    "header.nav.menu": ["القائمة", "Menu"],
    "dashboard.menu.dashboard": ["لوحة التحكم", "Dashboard"],
    "dashboard.menu.reports": ["التقارير", "Reports"],
    "dashboard.menu.costs": ["التكاليف", "Costs"],
    "dashboard.menu.connectStore": ["ربط المتجر", "Connect store"],
    "dashboard.menu.billing": ["الاشتراك والفوترة", "Subscription and billing"],
    "dashboard.menu.settings": ["الإعدادات", "Settings"],
  } as const;

  for (const [key, [arabic, english]] of Object.entries(expected)) {
    assert.equal(t("ar", key), arabic);
    assert.equal(t("en", key), english);
    assert.notEqual(t("ar", key), key);
    assert.notEqual(t("en", key), key);
  }

  const headerSource = readFileSync(
    new URL("../src/components/layout/header.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(headerSource, /\|\|\s*["'](?:Menu|Billing)["']/);
  assert.doesNotMatch(headerSource, /HEADER\.NAV\.MENU/);
  assert.match(headerSource, /<dialog/);
  assert.match(headerSource, /\.showModal\(\)/);
  assert.match(headerSource, /data-drawer-close/);
});

test("cost and report views always resolve to loading, error, empty, or data", () => {
  assert.equal(getLoadViewState({ loading: true, hasError: false, itemCount: 0 }), "loading");
  assert.equal(getLoadViewState({ loading: false, hasError: true, itemCount: 0 }), "error");
  assert.equal(getLoadViewState({ loading: false, hasError: false, itemCount: 0 }), "empty");
  assert.equal(getLoadViewState({ loading: false, hasError: false, itemCount: 3 }), "data");
});

test("weekly comparison formatter produces plain Arabic and English explanations", () => {
  const comparison: ReportComparison = {
    current: {
      id: "current",
      timeRangeStart: 0,
      timeRangeEnd: 0,
      sales: 10429.44,
      profit: 1849.36,
      marginPct: 17.73,
      orders: 42,
    },
    previous: {
      id: "previous",
      timeRangeStart: 0,
      timeRangeEnd: 0,
      sales: 2097.17,
      profit: 0,
      marginPct: 0,
      orders: 12,
    },
    deltas: {
      salesDeltaPct: 397.31,
      profitDeltaPct: null,
      marginDeltaPct: 17.73,
      ordersDelta: 30,
    },
    status: "improved",
  };

  const arabic = formatReportComparison(comparison, "ar");
  const english = formatReportComparison(comparison, "en");

  assert.ok(arabic);
  assert.ok(english);
  assert.equal(
    arabic.metrics[0].summary,
    "المبيعات ارتفعت من 2,097.17 ر.س إلى 10,429.44 ر.س.",
  );
  assert.equal(arabic.metrics[0].change, "الزيادة: 8,332.27 ر.س");
  assert.equal(arabic.metrics[0].rate, "نسبة النمو: 397.31%");
  assert.equal(
    arabic.interpretation,
    "أداؤك الإجمالي هذا الأسبوع أفضل من الأسبوع السابق. راجع تفاصيل كل مؤشر لمعرفة أسباب التحسن.",
  );
  assert.match(english.metrics[0].summary, /^Sales increased from /);
  assert.equal(arabic.metrics.some((metric) => metric.summary.includes("→")), false);
  assert.equal(english.metrics.some((metric) => metric.summary.includes("→")), false);
});

test("interaction guards prevent stale comparisons and nested CTA key capture", () => {
  const reportsSource = readFileSync(
    new URL("../src/app/dashboard/reports/reports-client.tsx", import.meta.url),
    "utf8",
  );
  const pricingSource = readFileSync(
    new URL("../src/components/sections/pricing.tsx", import.meta.url),
    "utf8",
  );
  const billingSource = readFileSync(
    new URL("../src/app/billing/billing-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(reportsSource, /compareAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(
    reportsSource,
    /requestGeneration !== compareGenerationRef\.current/,
  );
  assert.match(pricingSource, /e\.target !== e\.currentTarget/);
  assert.match(billingSource, /\[status, tapId, router\]/);
  assert.doesNotMatch(billingSource, /\[status, tapId, router, lang\]/);
});