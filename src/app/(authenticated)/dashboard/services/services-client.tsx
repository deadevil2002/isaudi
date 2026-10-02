'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BadgeCheck, CircleAlert, ExternalLink, ScanSearch } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { LandingPageAnalysisResult } from '@/lib/landing-page/types';
import type { CustomerReferral, ReferralEligibilityResult } from '@/lib/referrals/types';

type Store = { merchantId: string; storeName: string | null; storefrontOrigin: string | null };

const copy = {
  ar: {
    eyebrow: 'تحليل مبني على الدليل', title: 'تحسين صفحة المتجر',
    description: 'يفحص iSaudi صفحة متجرك الموثقة ويعرض المشكلات القابلة للإثبات فقط. الخدمة الخارجية اختيارية وتظهر بعد النتيجة.',
    store: 'المتجر', analyze: 'تحليل الصفحة', analyzing: 'جارٍ التحليل…', connect: 'اربط متجر Salla موثقاً أولاً',
    connectAction: 'ربط متجر', noFindings: 'لم يكتشف التحليل الحتمي مشكلة مدعومة بأدلة في هذه الصفحة.',
    insufficient: 'المحتوى المتاح غير كافٍ لإصدار نتائج موثوقة. لم تُنشأ أي إحالة.',
    evidence: 'الدليل', impact: 'الأثر المحتمل', action: 'ما يمكنك فعله',
    optional: 'تنفيذ اختياري', help: 'تحتاج مساعدة في تنفيذ هذا التحسين؟',
    viewService: 'عرض الخدمة', providedBy: 'مقدم من', unavailable: 'تعذر إكمال التحليل الآن. حاول لاحقاً.',
    private: 'لا تُرسل بيانات متجرك أو تقريرك أو بريدك إلى الشريك.',
  },
  en: {
    eyebrow: 'Evidence-based analysis', title: 'Storefront page improvement',
    description: 'iSaudi checks your verified storefront and reports only issues it can prove. External help is optional and appears after the finding.',
    store: 'Store', analyze: 'Analyze page', analyzing: 'Analyzing…', connect: 'Connect a verified Salla store first',
    connectAction: 'Connect store', noFindings: 'The deterministic analysis found no evidence-backed issue on this page.',
    insufficient: 'The available content is insufficient for reliable findings. No referral was created.',
    evidence: 'Evidence', impact: 'Potential impact', action: 'What you can do',
    optional: 'Optional execution', help: 'Need help implementing this improvement?',
    viewService: 'View service', providedBy: 'Provided by', unavailable: 'The analysis could not be completed now. Try again later.',
    private: 'Your store data, report, and email are not sent to the partner.',
  },
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.reason || result.error || 'request_failed');
  return result as T;
}
function ReferralOffer({ referral, lang }: { referral: CustomerReferral; lang: 'ar' | 'en' }) {
  const t = copy[lang];
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/referrals/shown', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralId: referral.referralId }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [referral.referralId]);
  return <aside className="mt-5 rounded-2xl border border-[#d7b568]/20 bg-[#d7b568]/[.06] p-4" aria-label={t.optional}><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#d7b568]">{t.optional}</p><h3 className="mt-2 font-semibold text-white">{t.help}</h3><p className="mt-2 text-sm leading-6 text-[#a4b0c0]">{lang === 'ar' ? referral.offer.descriptionAr : referral.offer.descriptionEn}</p><p className="mt-3 text-xs text-[#728196]">{t.providedBy}: {referral.offer.partnerName}</p><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-[#728196]">{t.private}</p><Link href={referral.redirectPath} className="isaudi-focus inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d7b568] px-4 font-semibold text-[#071018] hover:bg-[#ecd08a]">{t.viewService}<ExternalLink className="h-4 w-4" aria-hidden="true" /></Link></div></aside>;
}

export function LandingPageServicesClient({ stores }: { stores: Store[] }) {
  const { lang } = useLanguage(); const t = copy[lang];
  const [merchantId, setMerchantId] = useState(stores[0]?.merchantId ?? '');
  const [analysis, setAnalysis] = useState<LandingPageAnalysisResult | null>(null);
  const [eligibility, setEligibility] = useState<ReferralEligibilityResult | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const referralByFinding = useMemo(() => new Map(
    (eligibility?.referrals ?? []).map((item) => [item.findingCode, item])
  ), [eligibility]);
  async function analyze() {
    setBusy(true); setError(''); setAnalysis(null); setEligibility(null);
    try {
      const result = await post<{ analysis: LandingPageAnalysisResult }>(
        '/api/analysis/landing-page', { merchantId }
      );
      setAnalysis(result.analysis);
      if (result.analysis.status === 'succeeded' && result.analysis.findings.length) {
        setEligibility(await post<ReferralEligibilityResult>(
          '/api/referrals/eligible', { analysisId: result.analysis.id }
        ));
      }
    } catch { setError(t.unavailable); }
    finally { setBusy(false); }
  }
  return <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 text-[#f0f4f8]"><section className="isaudi-card p-5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="isaudi-eyebrow">{t.eyebrow}</p><h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{t.title}</h1><p className="mt-3 text-sm leading-7 text-[#a4b0c0]">{t.description}</p></div><ScanSearch className="h-10 w-10 text-[#d7b568]" aria-hidden="true" /></div>{stores.length === 0 ? <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-white/10 p-5"><p className="text-sm text-[#a4b0c0]">{t.connect}</p><Link href="/connect/salla" className="isaudi-focus inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#d7b568] px-4 font-semibold text-[#071018]">{t.connectAction}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Link></div> : <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-sm font-medium text-[#c7d0db]">{t.store}<select value={merchantId} onChange={(event) => { setMerchantId(event.target.value); setAnalysis(null); setEligibility(null); }} className="isaudi-focus mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111922] px-4 text-white">{stores.map((store) => <option key={store.merchantId} value={store.merchantId}>{store.storeName || store.storefrontOrigin || store.merchantId}</option>)}</select></label><button type="button" disabled={busy || !merchantId} onClick={() => void analyze()} className="isaudi-focus min-h-12 rounded-xl bg-[#d7b568] px-6 font-semibold text-[#071018] hover:bg-[#ecd08a] disabled:cursor-not-allowed disabled:opacity-50">{busy ? t.analyzing : t.analyze}</button></div>}{error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}</section>{analysis && <section aria-live="polite" className="space-y-4">{analysis.status === 'insufficient_evidence' ? <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100"><CircleAlert className="mb-3 h-6 w-6" aria-hidden="true" />{t.insufficient}</div> : analysis.findings.length === 0 ? <div className="rounded-3xl border border-teal-400/20 bg-teal-400/10 p-6 text-teal-100"><BadgeCheck className="mb-3 h-6 w-6" aria-hidden="true" />{t.noFindings}</div> : analysis.findings.map((finding) => { const referral = referralByFinding.get(finding.findingCode); return <article key={finding.findingCode} className="isaudi-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-white">{finding.title}</h2><p className="mt-2 text-sm leading-6 text-[#a4b0c0]">{finding.description}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-[#c7d0db]">{finding.severity} · {finding.confidence}</span></div><dl className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><dt className="text-xs font-semibold text-[#d7b568]">{t.evidence}</dt><dd className="mt-2 text-sm leading-6 text-[#c7d0db]">{finding.evidence.map((item) => `${item.signal}: ${String(item.observed)}`).join(' · ')}</dd></div><div className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><dt className="text-xs font-semibold text-[#d7b568]">{t.impact}</dt><dd className="mt-2 text-sm leading-6 text-[#c7d0db]">{finding.potentialImpact}</dd></div><div className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><dt className="text-xs font-semibold text-[#d7b568]">{t.action}</dt><dd className="mt-2 text-sm leading-6 text-[#c7d0db]">{finding.recommendation}</dd></div></dl>{referral && <ReferralOffer referral={referral} lang={lang} />}</article>; })}</section>}</div>;
}
