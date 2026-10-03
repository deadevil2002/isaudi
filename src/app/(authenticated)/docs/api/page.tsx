import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/utils';
import { getUserEntitlements } from '@/lib/subscription/service';

export const dynamic = 'force-dynamic';

const code = 'rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm text-[#d9e2ec] overflow-x-auto';

export default async function BusinessApiDocsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.isActiveNow || !entitlements.limits.apiAccess) redirect('/settings');
  const lang = (await cookies()).get('lang')?.value === 'en' ? 'en' : 'ar';
  const ar = lang === 'ar';
  return <div dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 text-[#d9e2ec]">
    <header className="rounded-3xl border border-[#0fc9a7]/20 bg-[#0e1218] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#0fc9a7]">iSaudi API v1</p><h1 className="mt-3 text-3xl font-bold text-white">{ar ? 'وثائق Business API' : 'Business API documentation'}</h1><p className="mt-3 max-w-3xl leading-7 text-[#94a3b8]">{ar ? 'واجهة خادم إلى خادم للقراءة فقط. لا تستخدم المفتاح في المتصفح أو روابط URL.' : 'A read-only server-to-server API. Never place the key in browser code or URLs.'}</p></header>
    <section className="isaudi-card p-5 sm:p-6"><h2 className="text-xl font-bold text-white">{ar ? 'البدء' : 'Getting started'}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-[#94a3b8]">Base URL</dt><dd dir="ltr" className="mt-1 font-mono text-[#e6b95c]">https://isaudi-staging.isaudi-official.workers.dev/api/v1</dd></div><div><dt className="text-sm text-[#94a3b8]">Version</dt><dd className="mt-1">v1</dd></div></dl><pre className={`${code} mt-4`} dir="ltr"><code>{`curl https://isaudi-staging.isaudi-official.workers.dev/api/v1/account \\\n  -H "Authorization: Bearer <API_KEY>"`}</code></pre></section>
    <section className="isaudi-card p-5 sm:p-6"><h2 className="text-xl font-bold text-white">{ar ? 'النطاقات والمسارات' : 'Scopes and endpoints'}</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-white/10 text-start text-[#94a3b8]"><th className="p-3 text-start">Scope</th><th className="p-3 text-start">Endpoint</th><th className="p-3 text-start">{ar ? 'الوصف' : 'Description'}</th></tr></thead><tbody>{[
      ['account:read', 'GET /account', ar ? 'هوية الحساب والخطة والنطاقات' : 'Account identity, plan, and scopes'],
      ['stores:read', 'GET /stores', ar ? 'بيانات آمنة للمتاجر المتصلة' : 'Safe connected-store metadata'],
      ['reports:read', 'GET /reports?limit=20&cursor=…', ar ? 'ملخصات تقارير بترقيم cursor' : 'Cursor-paginated report summaries'],
      ['reports:read', 'GET /reports/{id}', ar ? 'تقرير مملوك وتحليله المعروض للعميل' : 'Owned report and customer-visible analysis'],
    ].map(row => <tr key={row[1]} className="border-b border-white/[.06]"><td className="p-3 font-mono text-[#0fc9a7]">{row[0]}</td><td dir="ltr" className="p-3 font-mono text-white">{row[1]}</td><td className="p-3 text-[#a4b0c0]">{row[2]}</td></tr>)}</tbody></table></div></section>
    <section className="grid gap-6 lg:grid-cols-2"><article className="isaudi-card p-5 sm:p-6"><h2 className="text-lg font-bold text-white">{ar ? 'الأخطاء' : 'Errors'}</h2><pre className={`${code} mt-4`} dir="ltr"><code>{`{"error":{"code":"invalid_api_key","message":"…"}}`}</code></pre><p className="mt-3 text-sm leading-6 text-[#94a3b8]">400 invalid request · 401 key · 403 entitlement/scope · 404 ownership-safe · 429 rate limit · 500/503 generic.</p></article><article className="isaudi-card p-5 sm:p-6"><h2 className="text-lg font-bold text-white">{ar ? 'الحدود والإلغاء' : 'Limits and revocation'}</h2><p className="mt-3 text-sm leading-7 text-[#94a3b8]">{ar ? 'حدود مؤقتة: 120 طلبًا لكل مفتاح و300 لكل حساب خلال 15 دقيقة. الحد الأقصى 50 تقريرًا في الصفحة. الإلغاء والتدوير يوقفان المفتاح القديم فورًا.' : 'Provisional limits: 120 requests per key and 300 per account per 15 minutes. Up to 50 reports per page. Revoke and rotate invalidate the old key immediately.'}</p></article></section>
    <a href="/settings" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-[#161c24] px-5 font-semibold text-white hover:bg-[#1d252f]">{ar ? 'العودة إلى الإعدادات' : 'Back to settings'}</a>
  </div>;
}
