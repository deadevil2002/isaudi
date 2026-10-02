'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ChartNoAxesCombined, Handshake, MousePointerClick, Tags } from 'lucide-react';

type Lang = 'ar' | 'en';
type Row = Record<string, unknown>;
type Dashboard = {
  metrics: { today: Metric; month: Metric };
  breakdown: Row[];
  categories: Row[];
  offers: Row[];
  referrals: Row[];
  clicks: Row[];
  commissions: { earnedHalala: number; verifiedConversions: number; foundationOnly: boolean };
};
type Metric = { referrals: number; shown: number; uniqueViewers: number; clicks: number; uniqueClickers: number; ctr: number };
type Tab = 'categories' | 'offers' | 'referrals' | 'clicks' | 'commissions';

const copy = {
  ar: {
    title: 'إحالات الخدمات', subtitle: 'طبقة تنفيذ اختيارية بعد نتيجة iSaudi المثبتة.',
    categories: 'الفئات', offers: 'عروض الشركاء', referrals: 'الإحالات', clicks: 'النقرات', commissions: 'العمولات',
    today: 'اليوم', month: 'هذا الشهر', shown: 'مرات الظهور', uniqueViewers: 'مشاهدون فريدون', totalClicks: 'إجمالي النقرات', uniqueClickers: 'ناقرون فريدون', ctr: 'CTR',
    loading: 'جارٍ تحميل البيانات…', error: 'تعذر تحميل بيانات الإحالات.', save: 'حفظ', saving: 'جارٍ الحفظ…', edit: 'تعديل', cancel: 'إلغاء',
    noData: 'لا توجد بيانات بعد.', createCategory: 'إضافة فئة', editCategory: 'تعديل الفئة', createOffer: 'إضافة عرض شريك', editOffer: 'تعديل عرض الشريك',
    active: 'نشط', inactive: 'غير نشط', approved: 'معتمد', review: 'قيد المراجعة', suspended: 'موقوف', rejected: 'مرفوض',
    foundation: 'أساس العمولات فقط', foundationHelp: 'النقرة ليست تحويلاً ولا تُنشئ عمولة. لا توجد تسوية في Phase 6C.',
  },
  en: {
    title: 'Service Referrals', subtitle: 'An optional execution layer after a proven iSaudi finding.',
    categories: 'Categories', offers: 'Partner Offers', referrals: 'Referrals', clicks: 'Clicks', commissions: 'Commissions',
    today: 'Today', month: 'This month', shown: 'Impressions / Shown', uniqueViewers: 'Unique viewers', totalClicks: 'Total clicks', uniqueClickers: 'Unique clickers', ctr: 'CTR',
    loading: 'Loading referral data…', error: 'Unable to load referral data.', save: 'Save', saving: 'Saving…', edit: 'Edit', cancel: 'Cancel',
    noData: 'No data yet.', createCategory: 'Add category', editCategory: 'Edit category', createOffer: 'Add partner offer', editOffer: 'Edit partner offer',
    active: 'Active', inactive: 'Inactive', approved: 'Approved', review: 'In review', suspended: 'Suspended', rejected: 'Rejected',
    foundation: 'Commission foundation only', foundationHelp: 'A click is not a conversion and does not earn commission. Phase 6C has no settlement.',
  },
};

async function adminApi(action: string, payload?: Record<string, unknown>) {
  const response = await fetch(`/admin/api/${action}`, {
    method: payload ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

function value(row: Row | null, key: string, fallback = ''): string {
  return row?.[key] == null ? fallback : String(row[key]);
}

function MetricCard({ label, value: metricValue, note }: { label: string; value: string; note?: string }) {
  return <article className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-white">{metricValue}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</article>;
}

function Field({ label, name, defaultValue, type = 'text', required = true }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean }) {
  return <label className="block text-sm font-medium text-slate-300">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className="isaudi-focus mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white" /></label>;
}

function Select({ label, name, defaultValue, children }: { label: string; name: string; defaultValue?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300">{label}<select name={name} defaultValue={defaultValue} className="isaudi-focus mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111922] px-3 text-white">{children}</select></label>;
}

function CategoryEditor({ lang, selected, onSaved, onCancel }: { lang: Lang; selected: Row | null; onSaved: () => Promise<void>; onCancel: () => void }) {
  const t = copy[lang]; const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      await adminApi('service-category-save', {
        ...(selected?.id ? { id: selected.id } : {}), slug: data.get('slug'),
        nameAr: data.get('nameAr'), nameEn: data.get('nameEn'),
        descriptionAr: data.get('descriptionAr'), descriptionEn: data.get('descriptionEn'),
        active: data.get('active') === 'on', minimumConfidence: data.get('minimumConfidence'),
        minimumSeverity: data.get('minimumSeverity'),
        maxReferralsPerAnalysis: Number(data.get('maxReferralsPerAnalysis')),
      });
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-[#0d151d] p-5 sm:p-6"><h3 className="font-semibold">{selected ? t.editCategory : t.createCategory}</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Slug" name="slug" defaultValue={value(selected, 'slug')} /><Field label="الاسم العربي" name="nameAr" defaultValue={value(selected, 'name_ar')} /><Field label="English name" name="nameEn" defaultValue={value(selected, 'name_en')} /><Field label="الوصف العربي" name="descriptionAr" required={false} defaultValue={value(selected, 'description_ar')} /><Field label="English description" name="descriptionEn" required={false} defaultValue={value(selected, 'description_en')} /><Select label="Minimum confidence" name="minimumConfidence" defaultValue={value(selected, 'minimum_confidence', 'high')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select><Select label="Minimum severity" name="minimumSeverity" defaultValue={value(selected, 'minimum_severity', 'medium')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select><Field label="Max referrals per analysis" name="maxReferralsPerAnalysis" type="number" defaultValue={value(selected, 'max_referrals_per_analysis', '1')} /></div><label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-sm"><input type="checkbox" name="active" defaultChecked={Number(selected?.active ?? 0) === 1} className="h-5 w-5" />{t.active}</label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<div className="flex flex-wrap gap-2"><button disabled={busy} className="isaudi-focus min-h-11 rounded-xl bg-[#d7b568] px-5 font-semibold text-[#071018] disabled:opacity-50">{busy ? t.saving : t.save}</button>{selected && <button type="button" onClick={onCancel} className="isaudi-focus min-h-11 rounded-xl border border-white/10 px-5">{t.cancel}</button>}</div></form>;
}

function OfferEditor({ lang, selected, categories, onSaved, onCancel }: { lang: Lang; selected: Row | null; categories: Row[]; onSaved: () => Promise<void>; onCancel: () => void }) {
  const t = copy[lang]; const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [commissionType, setCommissionType] = useState(value(selected, 'commission_type', 'percentage'));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try {
      await adminApi('partner-offer-save', {
        ...(selected?.id ? { id: selected.id } : {}), serviceCategoryId: data.get('serviceCategoryId'),
        partnerName: data.get('partnerName'), partnerUrl: data.get('partnerUrl'),
        serviceTitleAr: data.get('serviceTitleAr'), serviceTitleEn: data.get('serviceTitleEn'),
        descriptionAr: data.get('descriptionAr'), descriptionEn: data.get('descriptionEn'),
        supportedPlatforms: ['salla'], commissionType,
        commissionRateBps: commissionType === 'percentage' ? Number(data.get('commissionRateBps')) : null,
        fixedAmountHalala: commissionType === 'fixed' ? Number(data.get('fixedAmountHalala')) : null,
        commissionCurrency: commissionType === 'fixed' ? data.get('commissionCurrency') : null,
        status: data.get('status'), displayPriority: Number(data.get('displayPriority')),
        qualityStatus: data.get('qualityStatus'),
      });
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-[#0d151d] p-5 sm:p-6"><h3 className="font-semibold">{selected ? t.editOffer : t.createOffer}</h3><div className="grid gap-4 md:grid-cols-2"><Select label={t.categories} name="serviceCategoryId" defaultValue={value(selected, 'service_category_id', value(categories[0] ?? null, 'id'))}>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{lang === 'ar' ? String(category.name_ar) : String(category.name_en)}</option>)}</Select><Field label={lang === 'ar' ? 'اسم الشريك' : 'Partner name'} name="partnerName" defaultValue={value(selected, 'partner_name')} /><Field label="HTTPS URL" name="partnerUrl" type="url" defaultValue={value(selected, 'partner_url')} /><Field label="عنوان الخدمة بالعربية" name="serviceTitleAr" defaultValue={value(selected, 'service_title_ar')} /><Field label="English service title" name="serviceTitleEn" defaultValue={value(selected, 'service_title_en')} /><Field label="الوصف العربي" name="descriptionAr" required={false} defaultValue={value(selected, 'description_ar')} /><Field label="English description" name="descriptionEn" required={false} defaultValue={value(selected, 'description_en')} /><Select label="Platform" name="platform" defaultValue="salla"><option value="salla">Salla</option></Select><label className="block text-sm font-medium text-slate-300">Commission type<select name="commissionType" value={commissionType} onChange={(event) => setCommissionType(event.target.value)} className="isaudi-focus mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#111922] px-3 text-white"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></label>{commissionType === 'percentage' ? <Field label="Rate (basis points)" name="commissionRateBps" type="number" defaultValue={value(selected, 'commission_rate_bps', '0')} /> : <><Field label="Fixed amount (halala)" name="fixedAmountHalala" type="number" defaultValue={value(selected, 'fixed_amount_halala', '0')} /><Field label="Currency" name="commissionCurrency" defaultValue={value(selected, 'commission_currency', 'SAR')} /></>}<Select label="Status" name="status" defaultValue={value(selected, 'status', 'inactive')}><option value="inactive">{t.inactive}</option><option value="active">{t.active}</option><option value="suspended">{t.suspended}</option></Select><Select label="Quality" name="qualityStatus" defaultValue={value(selected, 'quality_status', 'review')}><option value="review">{t.review}</option><option value="approved">{t.approved}</option><option value="rejected">{t.rejected}</option></Select><Field label="Display priority" name="displayPriority" type="number" defaultValue={value(selected, 'display_priority', '100')} /></div>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<div className="flex flex-wrap gap-2"><button disabled={busy || categories.length === 0} className="isaudi-focus min-h-11 rounded-xl bg-[#d7b568] px-5 font-semibold text-[#071018] disabled:opacity-50">{busy ? t.saving : t.save}</button>{selected && <button type="button" onClick={onCancel} className="isaudi-focus min-h-11 rounded-xl border border-white/10 px-5">{t.cancel}</button>}</div></form>;
}

function History({ rows, lang }: { rows: Row[]; lang: Lang }) {
  const t = copy[lang];
  return rows.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">{t.noData}</p> : <div className="grid gap-3">{rows.map((row) => <article key={String(row.id)} className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-white">{String(row.finding_code ?? row.event_type ?? '—')}</p><p className="mt-1 text-xs text-slate-500">{String(row.customer_identifier ?? '')} · {String(row.category_slug ?? '')}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">{String(row.status ?? row.event_type ?? '—')}</span></div><p className="mt-3 text-xs text-slate-500">{new Date(Number(row.created_at)).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} · {String(row.partner_name ?? '')}</p></article>)}</div>;
}

export function ServiceReferralsManager({ lang }: { lang: Lang }) {
  const t = copy[lang]; const [tab, setTab] = useState<Tab>('categories'); const [data, setData] = useState<Dashboard | null>(null); const [error, setError] = useState(''); const [selectedCategory, setSelectedCategory] = useState<Row | null>(null); const [selectedOffer, setSelectedOffer] = useState<Row | null>(null);
  const load = useCallback(async () => { setError(''); try { setData(await adminApi('service-referrals')); } catch { setError(t.error); } }, [t.error]);
  useEffect(() => {
    let active = true;
    void adminApi('service-referrals').then((result) => {
      if (!active) return;
      setData(result);
      setError('');
    }).catch(() => {
      if (active) setError(t.error);
    });
    return () => { active = false; };
  }, [t.error]);
  if (!data && !error) return <p className="rounded-3xl border border-white/10 bg-[#0d151d] p-10 text-center text-slate-400">{t.loading}</p>;
  if (!data) return <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p>;
  const tabs: Array<[Tab, string, typeof Tags]> = [['categories', t.categories, Tags], ['offers', t.offers, Handshake], ['referrals', t.referrals, BadgeCheck], ['clicks', t.clicks, MousePointerClick], ['commissions', t.commissions, ChartNoAxesCombined]];
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">{t.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t.subtitle}</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-7"><MetricCard label={`${t.referrals} · ${t.today}`} value={String(data.metrics.today.referrals)} /><MetricCard label={`${t.referrals} · ${t.month}`} value={String(data.metrics.month.referrals)} /><MetricCard label={t.shown} value={String(data.metrics.month.shown)} /><MetricCard label={t.uniqueViewers} value={String(data.metrics.month.uniqueViewers)} /><MetricCard label={t.totalClicks} value={String(data.metrics.month.clicks)} /><MetricCard label={t.uniqueClickers} value={String(data.metrics.month.uniqueClickers)} /><MetricCard label={t.ctr} value={`${(data.metrics.month.ctr * 100).toFixed(1)}%`} note={`${data.metrics.month.uniqueClickers} ÷ ${data.metrics.month.uniqueViewers}`} /></div><div role="tablist" aria-label={t.title} className="flex flex-wrap gap-2">{tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`isaudi-focus inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm ${tab === id ? 'border-[#d7b568]/40 bg-[#d7b568]/15 text-[#f3ce7c]' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}><Icon className="h-4 w-4" aria-hidden="true" />{label}</button>)}</div>{tab === 'categories' && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><CategoryEditor lang={lang} selected={selectedCategory} onCancel={() => setSelectedCategory(null)} onSaved={async () => { setSelectedCategory(null); await load(); }} /><div className="grid content-start gap-3">{data.categories.map((row) => <article key={String(row.id)} className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{lang === 'ar' ? String(row.name_ar) : String(row.name_en)}</h3><p className="mt-1 font-mono text-xs text-slate-500">{String(row.slug)}</p></div><span className={`rounded-full px-2 py-1 text-xs ${Number(row.active) === 1 ? 'bg-teal-400/10 text-teal-200' : 'bg-white/5 text-slate-400'}`}>{Number(row.active) === 1 ? t.active : t.inactive}</span></div><button onClick={() => setSelectedCategory(row)} className="isaudi-focus mt-4 min-h-11 rounded-xl border border-white/10 px-4 text-sm">{t.edit}</button></article>)}</div></div>}{tab === 'offers' && <div className="grid gap-6 xl:grid-cols-2"><OfferEditor key={String(selectedOffer?.id ?? 'new')} lang={lang} selected={selectedOffer} categories={data.categories} onCancel={() => setSelectedOffer(null)} onSaved={async () => { setSelectedOffer(null); await load(); }} /><div className="grid content-start gap-3">{data.offers.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">{t.noData}</p> : data.offers.map((row) => <article key={String(row.id)} className="rounded-2xl border border-white/[.08] bg-black/15 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{String(row.partner_name)}</h3><p className="mt-1 text-sm text-slate-400">{lang === 'ar' ? String(row.service_title_ar) : String(row.service_title_en)}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">{String(row.status)} · {String(row.quality_status)}</span></div><button onClick={() => setSelectedOffer(row)} className="isaudi-focus mt-4 min-h-11 rounded-xl border border-white/10 px-4 text-sm">{t.edit}</button></article>)}</div></div>}{tab === 'referrals' && <History rows={data.referrals} lang={lang} />}{tab === 'clicks' && <History rows={data.clicks} lang={lang} />}{tab === 'commissions' && <section className="rounded-3xl border border-[#d7b568]/20 bg-[#d7b568]/[.06] p-6"><h2 className="font-semibold text-[#f3ce7c]">{t.foundation}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{t.foundationHelp}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><MetricCard label={lang === 'ar' ? 'تحويلات موثقة' : 'Verified conversions'} value={String(data.commissions.verifiedConversions)} /><MetricCard label={lang === 'ar' ? 'عمولة مكتسبة' : 'Earned commission'} value="SAR 0.00" /></div></section>}</div>;
}
