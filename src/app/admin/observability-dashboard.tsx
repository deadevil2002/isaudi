'use client';

import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Database,
  FileSpreadsheet,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Users,
  Video,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';

type Lang = 'ar' | 'en';
type Status = 'healthy' | 'warning' | 'error' | 'unknown';
type AiMetrics = {
  requestCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  providerErrorCount: number;
  status2xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  latencySamples: number;
  costMicroUsd: number;
  averageCostMicroUsd: number;
  averageTokens: number;
  cacheRatio: number;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
};
type SecretState = { required: boolean; present: boolean };
type LimitState = 'available' | 'approaching' | 'reached' | 'not_entitled';
type PlanEntitlements = {
  id: string;
  maxStores: number;
  maxReportsPerMonth: number;
  aiInsights: boolean;
  apiAccess: boolean;
  chat: { hourly: number; daily: number; concurrent: number };
  generate: { hourly: number; daily: number; concurrent: number };
};
type ObservabilityData = {
  generatedAt: number;
  systemHealth: Array<{ key: string; status: Status; observedAt: number | null }>;
  ai: {
    period: { today: AiMetrics; sevenDays: AiMetrics; thirtyDays: AiMetrics; billing: AiMetrics };
    generate: AiMetrics;
    chat: AiMetrics;
    modelUsage: Array<{ model: string; requestCount: number; totalTokens: number }>;
    openAiCreditBalance: string;
    pricing: { model: string; inputUsdPerMillion: number; cachedInputUsdPerMillion: number; outputUsdPerMillion: number; estimated: boolean };
  };
  plans: Array<{ plan: string; customers: number; reports: number; aiRequests: number; totalTokens: number; aiCostMicroUsd: number; averageAiCostMicroUsd: number; averageReports: number; catalogMonthlyRevenueHalala: number; entitlements: PlanEntitlements | null; reportCapacity: number | null; reportsStatus: LimitState }>;
  database: Record<string, number | string | boolean | null>;
  migrations: { currentLedger: Array<{ name: string; appliedAt: number | null }>; expectedSchema: string; pending: string[]; migration0014: string; migration0018: string; expectedReleaseSequence: string[]; expectedWrites: number; dailyBudget: number; remainingSafetyMargin: number; liveExpectedWrites: number | null; lastVerification: number | null };
  security: { adminSessions: number; customerSessions: number; otpFailures: number; adminLoginFailures: number; rateLimitEvents: number; promptInjectionDetections: number | null; webhookFailures: number; originFailures: number | null; rawSecurityEventsExposed: boolean };
  secrets: Record<string, SecretState>;
  cloudflare: { worker: string; environment: string; version: string | null; cpuObservations: number | null; errors1102: number | null; errors503: number | null; d1Errors: number | null; waf: string; rateLimit: string; minimumTls: string | null; tls13: boolean | null; cipherProfile: string | null; reason: string; lastCheckedAt: number };
  integrations: {
    resend: { configured: boolean; status: 'unknown'; deliveryHistory: 'not_recorded'; lastSuccessAt: number | null; lastFailureAt: number | null; deliveryFailures: number | null; suppressions: number | null };
    tap: { configured: boolean; stagingStatus: 'not_configured_in_staging'; attempts: number; successes: number; failures: number; integrityFailures: number; lastEventAt: number | null; accountBalance: number | null };
    salla: { integrationHealth: { status: 'unknown'; reason: string; lastCheckedAt: number }; customerStores: { total: number; connected: number; activeHealthy: number; reconnectRequired: number; inactive: number; pending: number; failedSyncs: number | null }; warnings: number; pendingLinkCodes: number; lastEventAt: number | null; webhookStatus: string };
    csv: { products: number; orders: number; lastImportAt: number | null; failedImports: number | null; rawContentRetained: boolean };
    video: { configured: boolean; enabled: boolean; updatedAt: number | null; provider: string };
  };
};
type Customer = {
  customerIdentifier: string;
  plan: string;
  aiRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  aiCostMicroUsd: number;
  reports: { used: number; allowance: number | null; remaining: number | null };
  stores: { used: number; allowance: number | null; remaining: number | null; status: LimitState };
  reportStatus: LimitState;
  entitlements: PlanEntitlements | null;
  chatQuota: { hourly: { used: number; limit: number; remaining: number }; daily: { used: number; limit: number; remaining: number } };
  generationQuota: { hourly: { used: number; limit: number; remaining: number }; daily: { used: number; limit: number; remaining: number } };
  catalogMonthlyRevenueHalala: number;
  estimatedContributionHalala: number;
};

const copy = {
  ar: {
    eyebrow: 'مركز التحكم والمراقبة', title: 'صحة iSaudi في مكان واحد', subtitle: 'مؤشرات تشغيلية وتجارية مبنية على أدلة مسجّلة — بلا أسرار أو تخمينات.', refresh: 'تحديث', loading: 'جارٍ تحميل المؤشرات…', failed: 'تعذر تحميل مؤشرات المراقبة.', system: 'صحة النظام', ai: 'ذكاء AI', economics: 'اقتصاديات العملاء', database: 'قاعدة البيانات', security: 'الأمان', integrations: 'التكاملات', observed: 'آخر دليل', unknown: 'غير معروف', healthy: 'سليم', warning: 'تنبيه', error: 'خطأ', requests: 'الطلبات', success: 'ناجح', failedCount: 'فاشل', tokens: 'إجمالي الرموز', cost: 'التكلفة التقديرية', today: 'اليوم', seven: '7 أيام', thirty: '30 يوماً', billing: 'فترة الفوترة', generation: 'إنشاء التحليل', chat: 'المحادثة', latency: 'زمن المزود', cache: 'ذاكرة الطلبات', customers: 'العملاء', reports: 'التقارير', stores: 'المتاجر', revenue: 'إيراد الخطة الشهري', loadCustomers: 'عرض العملاء', previous: 'السابق', next: 'التالي', noCustomers: 'لا توجد بيانات عملاء.', planEconomics: 'اقتصاديات الخطط', quotas: 'الحصص', unlimited: 'غير محدود', migrations: 'الترحيلات', secrets: 'حالة الأسرار', present: 'موجود', missing: 'مفقود', configured: 'مُعدّ', notConfigured: 'غير مُعدّ', unavailable: 'غير متاح عبر بيانات التطبيق', details: 'تفاصيل آمنة', estimated: 'تقديري', noInfra: 'لا يشمل تكلفة البنية التحتية أو رسوم الدفع.', emptyEvidence: 'لا توجد أدلة تشغيلية مسجلة بعد.', page: 'صفحة', customer: 'معرّف العميل', contribution: 'المساهمة بعد تكلفة AI', model: 'النموذج', databaseHealth: 'عدادات D1 المجمّعة', migrationHealth: 'جاهزية الترحيل', openAiBalance: 'رصيد OpenAI', liveExpected: 'القيمة الحية تُحسب فقط داخل مشغّل الإصدار.', notRun: 'لا يتم تشغيل فحص مكلف داخل اللوحة.', approximate: 'تقريبي من شرائح زمنية مسجلة', source: 'المصدر', required: 'مطلوب', optional: 'اختياري', cloudflareUnknown: 'CPU و1102 و503 وWAF وTLS غير متاحة لهذه الواجهة دون مصدر Telemetry مصادق.', emailUnknown: 'حالة التسليم غير معروفة / غير مسجلة؛ وجود المفتاح لا يثبت صحة التسليم.', customerPrivate: 'المعرّفات مستعارة ولا تظهر بيانات المتجر الخاصة.',
  },
  en: {
    eyebrow: 'Control & observability center', title: 'iSaudi health in one place', subtitle: 'Operational and business signals backed by recorded evidence — no secrets or guesses.', refresh: 'Refresh', loading: 'Loading observability…', failed: 'Observability could not be loaded.', system: 'System Health', ai: 'AI Intelligence', economics: 'Customer Economics', database: 'Database', security: 'Security', integrations: 'Integrations', observed: 'Evidence', unknown: 'Unknown', healthy: 'Healthy', warning: 'Warning', error: 'Error', requests: 'Requests', success: 'Succeeded', failedCount: 'Failed', tokens: 'Total tokens', cost: 'Estimated cost', today: 'Today', seven: '7 days', thirty: '30 days', billing: 'Billing period', generation: 'Generation', chat: 'Chat', latency: 'Provider latency', cache: 'Prompt cache', customers: 'Customers', reports: 'Reports', stores: 'Stores', revenue: 'Monthly plan revenue', loadCustomers: 'View customers', previous: 'Previous', next: 'Next', noCustomers: 'No customer data.', planEconomics: 'Plan economics', quotas: 'Quotas', unlimited: 'Unlimited', migrations: 'Migrations', secrets: 'Secrets health', present: 'Present', missing: 'Missing', configured: 'Configured', notConfigured: 'Not configured', unavailable: 'Not available via application data', details: 'Safe details', estimated: 'Estimated', noInfra: 'Excludes infrastructure and payment costs.', emptyEvidence: 'No recorded operational evidence yet.', page: 'Page', customer: 'Customer ID', contribution: 'Contribution after AI cost', model: 'Model', databaseHealth: 'Aggregated D1 counters', migrationHealth: 'Migration readiness', openAiBalance: 'OpenAI credit balance', liveExpected: 'The live expected value is calculated only by the release runner.', notRun: 'No expensive integrity scan is run by this dashboard.', approximate: 'Approximate from recorded latency buckets', source: 'Source', required: 'Required', optional: 'Optional', cloudflareUnknown: 'CPU, 1102, 503, WAF and TLS are unavailable here without an authenticated telemetry source.', emailUnknown: 'Delivery status is UNKNOWN / NOT RECORDED; key presence does not prove delivery health.', customerPrivate: 'Identifiers are pseudonymous; private store data is not shown.',
  },
} as const;

const healthIcons: Record<string, ComponentType<{ className?: string }>> = {
  ai: Bot, database: Database, authentication: ShieldCheck, email: MailCheck,
  salla: Store, csv: FileSpreadsheet, billing: CircleDollarSign, video: Video,
  cloudflare: Cloud,
};

const healthLabels: Record<Lang, Record<string, string>> = {
  ar: { ai: 'الذكاء الاصطناعي', database: 'قاعدة البيانات', authentication: 'المصادقة', email: 'البريد', salla: 'سلة', csv: 'CSV', billing: 'الفوترة', video: 'الفيديو', cloudflare: 'Cloudflare' },
  en: { ai: 'AI', database: 'Database', authentication: 'Authentication', email: 'Email', salla: 'Salla', csv: 'CSV', billing: 'Billing', video: 'Video', cloudflare: 'Cloudflare' },
};

function formatNumber(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 1 }).format(value);
}
function formatDate(value: number | null, lang: Lang) {
  return value ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : copy[lang].unknown;
}
function formatCost(microUsd: number) {
  if (!microUsd) return '$0.00';
  const value = microUsd / 1_000_000;
  return value < 0.000001 ? '<$0.000001' : `$${value.toFixed(value < 0.01 ? 6 : 2)}`;
}
function formatSar(halala: number, lang: Lang) {
  return `${formatNumber(halala / 100, lang)} SAR`;
}
function StatusBadge({ status, lang }: { status: Status; lang: Lang }) {
  const classes = status === 'healthy' ? 'border-teal-300/25 bg-teal-300/10 text-teal-200' : status === 'warning' ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : status === 'error' ? 'border-rose-300/25 bg-rose-300/10 text-rose-200' : 'border-slate-400/20 bg-slate-400/10 text-slate-300';
  return <span className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium ${classes}`}><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />{copy[lang][status]}</span>;
}
function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/[.08] bg-black/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-semibold tracking-tight text-white">{value}</p>{note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</div>;
}
function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28 rounded-[1.75rem] border border-white/[.09] bg-[linear-gradient(145deg,rgba(18,30,39,.92),rgba(8,14,19,.96))] p-4 shadow-[0_24px_70px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.04)] sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#d7b568]/20 bg-[#d7b568]/10 text-[#e5c979]"><Icon className="h-5 w-5" /></span><h2 className="text-lg font-semibold sm:text-xl">{title}</h2></div>{children}</section>;
}

function Customers({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ rows: Customer[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async (nextPage: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/admin/api/observability-customers?page=${nextPage}&pageSize=8`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('request failed');
      setResult(await response.json() as { rows: Customer[]; hasMore: boolean });
      setPage(nextPage);
    } finally { setLoading(false); }
  };
  if (!result) return <button onClick={() => void load(1)} disabled={loading} className="min-h-11 rounded-xl border border-[#d7b568]/30 bg-[#d7b568]/10 px-4 text-sm font-medium text-[#ead28f] transition hover:bg-[#d7b568]/15 disabled:opacity-50">{loading ? t.loading : t.loadCustomers}</button>;
  return <div className="space-y-3"><p className="text-xs text-slate-500">{t.customerPrivate}</p>{result.rows.length === 0 ? <p className="text-sm text-slate-400">{t.noCustomers}</p> : result.rows.map(customer => <details key={customer.customerIdentifier} className="group rounded-2xl border border-white/[.08] bg-black/15 open:border-[#d7b568]/20"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4"><span className="min-w-0"><span className="block truncate font-mono text-xs text-slate-300">{customer.customerIdentifier}</span><span className="mt-1 block text-xs capitalize text-[#d7b568]">{customer.plan}</span></span><span className="text-sm text-slate-300">{formatCost(customer.aiCostMicroUsd)}</span></summary><div className="grid grid-cols-2 gap-2 border-t border-white/[.07] p-3 xl:grid-cols-4"><Metric label={t.stores} value={`${formatNumber(customer.stores.used, lang)} / ${customer.stores.allowance == null ? t.unknown : formatNumber(customer.stores.allowance, lang)}`} note={customer.stores.status.replace('_', ' ')} /><Metric label={t.reports} value={`${formatNumber(customer.reports.used, lang)} / ${customer.reports.allowance == null ? t.unknown : formatNumber(customer.reports.allowance, lang)}`} note={customer.reportStatus.replace('_', ' ')} /><Metric label={`${t.chat} · 24h`} value={`${customer.chatQuota.daily.used}/${customer.chatQuota.daily.limit}`} /><Metric label={`${t.generation} · 24h`} value={`${customer.generationQuota.daily.used}/${customer.generationQuota.daily.limit}`} /><Metric label={t.requests} value={formatNumber(customer.aiRequests, lang)} /><Metric label={t.tokens} value={formatNumber(customer.totalTokens, lang)} /><Metric label={t.contribution} value={formatSar(customer.estimatedContributionHalala, lang)} note={t.noInfra} /><Metric label={t.revenue} value={formatSar(customer.catalogMonthlyRevenueHalala, lang)} /><Metric label={t.cost} value={formatCost(customer.aiCostMicroUsd)} note={t.estimated} /><Metric label={lang === 'ar' ? 'رؤى AI' : 'AI insights'} value={customer.entitlements?.aiInsights ? t.healthy : t.notConfigured} /><Metric label="API" value={customer.entitlements?.apiAccess ? t.healthy : t.notConfigured} /></div></details>)}<div className="flex items-center justify-between pt-2"><button disabled={page === 1 || loading} onClick={() => void load(page - 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 disabled:opacity-30" aria-label={t.previous}>{lang === 'ar' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button><span className="text-xs text-slate-500">{t.page} {page}</span><button disabled={!result.hasMore || loading} onClick={() => void load(page + 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 disabled:opacity-30" aria-label={t.next}>{lang === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></div></div>;
}

export function ObservabilityDashboard({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/admin/api/observability', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('request failed');
      setData(await response.json() as ObservabilityData);
    } catch { setError(t.failed); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !data) return <div className="rounded-3xl border border-white/10 bg-[#0d151d] p-10 text-center text-slate-400" aria-live="polite">{t.loading}</div>;
  if (error && !data) return <p role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">{error}</p>;
  if (!data) return null;

  const periodCards = [
    [t.today, data.ai.period.today], [t.seven, data.ai.period.sevenDays],
    [t.thirty, data.ai.period.thirtyDays], [t.billing, data.ai.period.billing],
  ] as const;
  const dbLabels: Array<[string, string]> = [
    ['users', t.customers], ['products', lang === 'ar' ? 'المنتجات' : 'Products'],
    ['orders', lang === 'ar' ? 'الطلبات' : 'Orders'], ['orderItems', lang === 'ar' ? 'عناصر الطلب' : 'Order items'],
    ['reports', t.reports], ['snapshots', lang === 'ar' ? 'اللقطات' : 'Snapshots'],
    ['subscriptions', lang === 'ar' ? 'الاشتراكات' : 'Subscriptions'], ['payments', lang === 'ar' ? 'المدفوعات' : 'Payments'],
    ['connections', lang === 'ar' ? 'الاتصالات' : 'Connections'],
  ];
  return <div className="space-y-5 overflow-x-clip">
    <div className="relative overflow-hidden rounded-[2rem] border border-[#d7b568]/15 bg-[radial-gradient(circle_at_top_right,rgba(25,137,126,.18),transparent_38%),linear-gradient(145deg,#111c24,#081016)] p-5 shadow-[0_28px_80px_rgba(0,0,0,.32)] sm:p-7"><div className="absolute -end-16 -top-20 h-48 w-48 rounded-full bg-[#d7b568]/10 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d7b568]">{t.eyebrow}</p><h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{t.subtitle}</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm text-slate-200 transition hover:bg-white/[.08] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t.refresh}</button></div><p className="relative mt-5 text-xs text-slate-500">{t.observed}: {formatDate(data.generatedAt, lang)}</p></div>

    <Section id="system-health" title={t.system} icon={Activity}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.systemHealth.map(item => { const Icon = healthIcons[item.key] ?? Activity; return <article key={item.key} className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[.08] bg-black/15 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.04] text-slate-300"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{healthLabels[lang][item.key] ?? item.key}</p><StatusBadge status={item.status} lang={lang} /></div><p className="mt-2 text-xs leading-5 text-slate-500">{t.observed}: {formatDate(item.observedAt, lang)}</p></div></article>; })}</div></Section>

    <Section id="ai-intelligence" title={t.ai} icon={Bot}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{periodCards.map(([label, metrics]) => <Metric key={label} label={label} value={formatCost(metrics.costMicroUsd)} note={`${formatNumber(metrics.requestCount, lang)} ${t.requests} · ${formatNumber(metrics.totalTokens, lang)} ${t.tokens}`} />)}</div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><h3 className="text-sm font-semibold">{t.generation}</h3><div className="mt-3 grid grid-cols-2 gap-2"><Metric label={t.requests} value={formatNumber(data.ai.generate.requestCount, lang)} /><Metric label={t.cost} value={formatCost(data.ai.generate.costMicroUsd)} /><Metric label={t.tokens} value={formatNumber(data.ai.generate.totalTokens, lang)} /><Metric label={t.failedCount} value={formatNumber(data.ai.generate.failureCount, lang)} /></div></div>
        <div className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><h3 className="text-sm font-semibold">{t.chat}</h3><div className="mt-3 grid grid-cols-2 gap-2"><Metric label={t.requests} value={formatNumber(data.ai.chat.requestCount, lang)} /><Metric label={t.cost} value={formatCost(data.ai.chat.costMicroUsd)} /><Metric label={t.tokens} value={formatNumber(data.ai.chat.totalTokens, lang)} /><Metric label={t.failedCount} value={formatNumber(data.ai.chat.failureCount, lang)} /></div></div>
      </div>
      <details className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4">
        <summary className="min-h-8 cursor-pointer text-sm font-medium text-slate-200">{t.details}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={`${t.latency} · avg`} value={data.ai.period.thirtyDays.averageLatencyMs == null ? t.unknown : `${data.ai.period.thirtyDays.averageLatencyMs} ms`} />
          <Metric label="P50" value={data.ai.period.thirtyDays.p50LatencyMs == null ? t.unknown : `≤ ${data.ai.period.thirtyDays.p50LatencyMs} ms`} note={t.approximate} />
          <Metric label="P95" value={data.ai.period.thirtyDays.p95LatencyMs == null ? t.unknown : `≤ ${data.ai.period.thirtyDays.p95LatencyMs} ms`} note={t.approximate} />
          <Metric label={t.cache} value={`${(data.ai.period.thirtyDays.cacheRatio * 100).toFixed(1)}%`} note={`${formatNumber(data.ai.period.thirtyDays.cachedInputTokens, lang)} cached · ${formatNumber(data.ai.period.thirtyDays.cacheWriteTokens, lang)} write`} />
          <Metric label={lang === 'ar' ? 'رموز الإدخال' : 'Input tokens'} value={formatNumber(data.ai.period.thirtyDays.inputTokens, lang)} />
          <Metric label={lang === 'ar' ? 'رموز الإخراج' : 'Output tokens'} value={formatNumber(data.ai.period.thirtyDays.outputTokens, lang)} />
          <Metric label={lang === 'ar' ? 'متوسط تكلفة الإنشاء' : 'Average generation cost'} value={formatCost(data.ai.generate.averageCostMicroUsd)} note={`${formatNumber(data.ai.generate.averageTokens, lang)} ${t.tokens}`} />
          <Metric label={lang === 'ar' ? 'متوسط تكلفة المحادثة' : 'Average chat cost'} value={formatCost(data.ai.chat.averageCostMicroUsd)} note={`${formatNumber(data.ai.chat.averageTokens, lang)} ${t.tokens}`} />
          <Metric label={t.success} value={formatNumber(data.ai.period.thirtyDays.successCount, lang)} />
          <Metric label={t.failedCount} value={formatNumber(data.ai.period.thirtyDays.failureCount, lang)} />
          <Metric label={lang === 'ar' ? 'انتهاء المهلة' : 'Timeouts'} value={formatNumber(data.ai.period.thirtyDays.timeoutCount, lang)} />
          <Metric label={lang === 'ar' ? 'تحديد المعدل' : 'Rate limited'} value={formatNumber(data.ai.period.thirtyDays.rateLimitCount, lang)} />
          <Metric label={lang === 'ar' ? 'أخطاء المزود' : 'Provider errors'} value={formatNumber(data.ai.period.thirtyDays.providerErrorCount, lang)} />
          <Metric label="HTTP 2xx / 4xx / 5xx" value={`${formatNumber(data.ai.period.thirtyDays.status2xxCount, lang)} / ${formatNumber(data.ai.period.thirtyDays.status4xxCount, lang)} / ${formatNumber(data.ai.period.thirtyDays.status5xxCount, lang)}`} />
          <Metric label={lang === 'ar' ? 'استخدام النماذج' : 'Model usage'} value={data.ai.modelUsage.length ? data.ai.modelUsage.map(item => `${item.model}: ${item.requestCount}`).join(' · ') : t.emptyEvidence} />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">{t.openAiBalance}: {lang === 'ar' ? 'غير متاح عبر واجهة التطبيق' : 'Not available via application API'} · {t.source}: OpenAI {data.ai.pricing.model} published rates.</p>
      </details>
    </Section>

    <Section id="customer-economics" title={t.economics} icon={Users}>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{t.planEconomics}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.plans.filter(plan => plan.plan !== 'unknown').map(plan => <article key={plan.plan} className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><div className="flex items-center justify-between gap-2"><h4 className="capitalize font-semibold">{plan.plan}</h4><span className="rounded-full bg-white/[.05] px-2 py-1 text-xs text-slate-400">{formatNumber(plan.customers, lang)} {t.customers}</span></div><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.stores}</dt><dd>{plan.entitlements ? formatNumber(plan.entitlements.maxStores, lang) : t.unknown} / {lang === 'ar' ? 'عميل' : 'customer'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.reports}</dt><dd>{formatNumber(plan.reports, lang)} {lang === 'ar' ? 'مستخدم' : 'used'} · {plan.entitlements ? formatNumber(plan.entitlements.maxReportsPerMonth, lang) : t.unknown} / {lang === 'ar' ? 'عميل' : 'customer'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.chat} · 24h</dt><dd>{plan.entitlements ? formatNumber(plan.entitlements.chat.daily, lang) : t.unknown} / {lang === 'ar' ? 'عميل' : 'customer'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.generation} · 24h</dt><dd>{plan.entitlements ? formatNumber(plan.entitlements.generate.daily, lang) : t.unknown} / {lang === 'ar' ? 'عميل' : 'customer'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.requests}</dt><dd>{formatNumber(plan.aiRequests, lang)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.tokens}</dt><dd>{formatNumber(plan.totalTokens, lang)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.cost}</dt><dd>{formatCost(plan.aiCostMicroUsd)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{lang === 'ar' ? 'متوسط التكلفة/عميل' : 'Average cost/customer'}</dt><dd>{formatCost(plan.averageAiCostMicroUsd)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{t.revenue}</dt><dd>{formatSar(plan.catalogMonthlyRevenueHalala, lang)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">API</dt><dd>{plan.entitlements?.apiAccess ? t.healthy : t.notConfigured}</dd></div></dl></article>)}</div>
      <div className="mt-5"><Customers lang={lang} /></div>
    </Section>

    <Section id="database" title={t.database} icon={Database}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{dbLabels.map(([key, label]) => <Metric key={key} label={label} value={formatNumber(Number(data.database[key] ?? 0), lang)} />)}</div>
      <details className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4">
        <summary className="min-h-8 cursor-pointer text-sm font-medium">{t.migrationHealth}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={lang === 'ar' ? 'المخطط المتوقع' : 'Expected schema'} value={data.migrations.expectedSchema.replace('.sql', '')} />
          <Metric label={lang === 'ar' ? 'سجل الترحيلات' : 'Current ledger'} value={formatNumber(data.migrations.currentLedger.length, lang)} note={data.migrations.currentLedger.at(-1)?.name ?? t.unknown} />
          <Metric label={lang === 'ar' ? 'المعلّق' : 'Pending'} value={formatNumber(data.migrations.pending.length, lang)} />
          <Metric label={lang === 'ar' ? 'آخر تحقق' : 'Last verification'} value={formatDate(data.migrations.lastVerification, lang)} />
          <Metric label="0014" value={data.migrations.migration0014.replaceAll('_', ' ')} />
          <Metric label="0018" value={data.migrations.migration0018} />
          <Metric label={lang === 'ar' ? 'ميزانية الكتابة' : 'Write budget'} value={formatNumber(data.migrations.dailyBudget, lang)} />
          <Metric label={lang === 'ar' ? 'المتوقع' : 'Expected'} value={formatNumber(data.migrations.expectedWrites, lang)} />
          <Metric label={lang === 'ar' ? 'هامش الأمان' : 'Safety margin'} value={formatNumber(data.migrations.remainingSafetyMargin, lang)} />
          <Metric label={lang === 'ar' ? 'المفاتيح الخارجية' : 'Foreign keys'} value={data.database.foreignKeysEnabled ? t.healthy : t.warning} />
          <Metric label={lang === 'ar' ? 'مشغلات Runtime' : 'Runtime triggers'} value={formatNumber(Number(data.database.runtimeTriggerCount ?? 0), lang)} />
          <Metric label={lang === 'ar' ? 'مشغلات المراقبة' : 'Observability triggers'} value={formatNumber(Number(data.database.observabilityTriggerCount ?? 0), lang)} />
          <Metric label={lang === 'ar' ? 'مشغل تجميع AI' : 'AI aggregate trigger'} value={formatNumber(Number(data.database.aiAggregateTriggerCount ?? 0), lang)} />
          <Metric label={lang === 'ar' ? 'حجم D1' : 'D1 size'} value={data.database.sizeBytes == null ? t.unknown : formatNumber(Number(data.database.sizeBytes), lang)} />
          <Metric label={lang === 'ar' ? 'فحص التكامل' : 'Integrity check'} value={data.database.integrity === 'not_run_on_dashboard' ? t.unavailable : String(data.database.integrity)} note={t.notRun} />
        </div>
        <p className="mt-4 break-words text-xs leading-5 text-slate-500"><span className="font-medium text-slate-400">{lang === 'ar' ? 'السجل الحالي' : 'Current ledger'}:</span> {data.migrations.currentLedger.map(item => item.name.replace('.sql', '')).join(' · ')}</p>
        <p className="mt-3 break-words text-xs leading-5 text-slate-500"><span className="font-medium text-slate-400">{lang === 'ar' ? 'ترتيب الإصدار' : 'Release sequence'}:</span> {data.migrations.expectedReleaseSequence.join(' → ')}</p>
        <p className="mt-3 text-xs leading-5 text-slate-500">{t.liveExpected} {t.notRun}</p>
      </details>
    </Section>

    <Section id="security" title={t.security} icon={ShieldCheck}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Metric label={lang === 'ar' ? 'جلسات الإدارة' : 'Admin sessions'} value={formatNumber(data.security.adminSessions, lang)} />
        <Metric label={lang === 'ar' ? 'جلسات العملاء' : 'Customer sessions'} value={formatNumber(data.security.customerSessions, lang)} />
        <Metric label={lang === 'ar' ? 'إخفاقات OTP' : 'OTP failures'} value={formatNumber(data.security.otpFailures, lang)} />
        <Metric label={lang === 'ar' ? 'إخفاقات المصادقة' : 'Authentication failures'} value={formatNumber(data.security.otpFailures + data.security.adminLoginFailures, lang)} />
        <Metric label={lang === 'ar' ? 'إخفاقات دخول الإدارة' : 'Admin login failures'} value={formatNumber(data.security.adminLoginFailures, lang)} />
        <Metric label={lang === 'ar' ? 'أحداث تحديد المعدل' : 'Rate-limit events'} value={formatNumber(data.security.rateLimitEvents, lang)} />
        <Metric label={lang === 'ar' ? 'اكتشاف حقن الأوامر' : 'Prompt-injection detections'} value={data.security.promptInjectionDetections == null ? t.unknown : formatNumber(data.security.promptInjectionDetections, lang)} />
        <Metric label={lang === 'ar' ? 'إخفاقات Webhook' : 'Webhook failures'} value={formatNumber(data.security.webhookFailures, lang)} />
        <Metric label={lang === 'ar' ? 'إخفاقات Origin' : 'Origin failures'} value={data.security.originFailures == null ? t.unknown : formatNumber(data.security.originFailures, lang)} />
        <Metric label={lang === 'ar' ? 'أحداث الأمان' : 'Security events'} value={formatNumber(data.security.otpFailures + data.security.adminLoginFailures + data.security.rateLimitEvents + data.security.webhookFailures, lang)} note={data.security.rawSecurityEventsExposed ? undefined : (lang === 'ar' ? 'بيانات مجمّعة فقط' : 'Aggregated metadata only')} />
      </div>
      <details className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4"><summary className="min-h-8 cursor-pointer text-sm font-medium">{t.secrets}</summary><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(data.secrets).map(([name, state]) => <div key={name} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/[.07] px-3"><span className="min-w-0 truncate font-mono text-xs text-slate-300">{name}</span><span className={`shrink-0 text-xs font-semibold ${state.present ? 'text-teal-300' : state.required ? 'text-rose-300' : 'text-slate-400'}`}>{state.present ? t.present : t.missing}</span></div>)}</div></details>
      <div className="mt-4 rounded-2xl border border-slate-300/10 bg-slate-300/[.04] p-4 text-xs leading-6 text-slate-400"><p><strong className="text-slate-300">UNKNOWN.</strong> {t.cloudflareUnknown}</p><p>{lang === 'ar' ? 'السبب' : 'Reason'}: {data.cloudflare.reason.replaceAll('_', ' ')}</p><p>{lang === 'ar' ? 'آخر فحص' : 'Last checked'}: {formatDate(data.cloudflare.lastCheckedAt, lang)}</p><p className="mt-2 font-mono text-slate-500">{data.cloudflare.worker} · {data.cloudflare.environment} · {data.cloudflare.version ?? t.unknown}</p></div>
    </Section>

    <Section id="integrations" title={t.integrations} icon={KeyRound}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><MailCheck className="h-5 w-5 text-[#d7b568]" /><h3 className="mt-3 font-semibold">Resend</h3><p className="mt-2 text-sm font-semibold text-slate-300">UNKNOWN / NOT RECORDED</p><p className="mt-2 text-xs leading-5 text-slate-500">{data.integrations.resend.configured ? `${t.configured} · ` : ''}{t.emailUnknown}</p></article>
        <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><CircleDollarSign className="h-5 w-5 text-[#d7b568]" /><h3 className="mt-3 font-semibold">Tap</h3><p className="mt-2 text-sm font-semibold text-slate-300">NOT CONFIGURED IN STAGING</p><p className="mt-2 text-xs leading-5 text-slate-500">{lang === 'ar' ? 'هذه ليست إشارة إلى فشل Tap في الإنتاج.' : 'This is not a Production Tap failure signal.'}</p></article>
        <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><Store className="h-5 w-5 text-[#d7b568]" /><h3 className="mt-3 font-semibold">{lang === 'ar' ? 'تكامل iSaudi مع سلة' : 'iSaudi Salla integration'}</h3><p className="mt-2 text-sm font-semibold text-slate-300">UNKNOWN</p><p className="mt-2 text-xs leading-5 text-slate-500">{lang === 'ar' ? 'صحة تطبيق الشركاء وقت التشغيل غير مسجلة، ولا تُستنتج من حالة Development/Live.' : 'Runtime Partner app health is not recorded and is not inferred from Development/Live status.'}<br />{lang === 'ar' ? 'آخر فحص' : 'Last checked'}: {formatDate(data.integrations.salla.integrationHealth.lastCheckedAt, lang)}</p></article>
        <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><Store className="h-5 w-5 text-teal-300" /><h3 className="mt-3 font-semibold">{lang === 'ar' ? 'متاجر العملاء في سلة' : 'Customer Salla stores'}</h3><p className="mt-2 text-sm text-slate-300">{formatNumber(data.integrations.salla.customerStores.total, lang)} {lang === 'ar' ? 'إجمالي' : 'total'} · {formatNumber(data.integrations.salla.customerStores.connected, lang)} {lang === 'ar' ? 'متصل' : 'connected'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{lang === 'ar' ? 'نشط/سليم' : 'Active/healthy'}: {formatNumber(data.integrations.salla.customerStores.activeHealthy, lang)}<br />{lang === 'ar' ? 'يحتاج إعادة ربط' : 'Reconnect required'}: {formatNumber(data.integrations.salla.customerStores.reconnectRequired, lang)}<br />{lang === 'ar' ? 'غير نشط' : 'Inactive'}: {formatNumber(data.integrations.salla.customerStores.inactive, lang)}<br />{lang === 'ar' ? 'معلّق' : 'Pending'}: {formatNumber(data.integrations.salla.customerStores.pending, lang)}<br />{lang === 'ar' ? 'مزامنات فاشلة' : 'Failed syncs'}: {t.unknown}<br />{t.observed}: {formatDate(data.integrations.salla.lastEventAt, lang)}</p></article>
        <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><FileSpreadsheet className="h-5 w-5 text-[#d7b568]" /><h3 className="mt-3 font-semibold">CSV</h3><p className="mt-2 text-sm text-slate-300">{data.integrations.csv.products} {lang === 'ar' ? 'منتج' : 'products'} · {data.integrations.csv.orders} {lang === 'ar' ? 'طلب' : 'orders'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{lang === 'ar' ? 'الرفع/النجاح' : 'Uploads/successes'}: {t.unknown}<br />{lang === 'ar' ? 'الواردات الفاشلة' : 'Failed imports'}: {data.integrations.csv.failedImports ?? t.unknown}<br />{lang === 'ar' ? 'تقارير مولّدة' : 'Reports generated'}: {t.unknown}<br />{t.observed}: {formatDate(data.integrations.csv.lastImportAt, lang)}<br />{lang === 'ar' ? 'المحتوى الخام محفوظ' : 'Raw content retained'}: {data.integrations.csv.rawContentRetained ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}</p></article>
      </div>
      <div className="mt-3 rounded-2xl border border-white/[.08] bg-black/15 p-4"><div className="flex items-start gap-3"><Video className="mt-0.5 h-5 w-5 shrink-0 text-[#d7b568]" /><div><h3 className="font-semibold">YouTube video</h3><p className="mt-1 text-sm text-slate-300">{data.integrations.video.configured ? t.configured : t.notConfigured} · {data.integrations.video.enabled ? (lang === 'ar' ? 'مفعّل' : 'Enabled') : (lang === 'ar' ? 'معطّل' : 'Disabled')}</p><p className="mt-1 text-xs text-slate-500">{t.observed}: {formatDate(data.integrations.video.updatedAt, lang)}</p></div></div></div>
    </Section>
  </div>;
}
