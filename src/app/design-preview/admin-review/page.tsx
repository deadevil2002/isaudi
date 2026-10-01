import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BarChart3, CreditCard, FileText, Link2, Settings, ShieldCheck, Users, Video } from 'lucide-react';
import { AdminVideoManager, type VideoFixture } from '@/app/admin/video-manager';

export default async function AdminReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const lang = query.lang === 'en' ? 'en' : 'ar';
  const states: VideoFixture[] = ['none', 'saving', 'ready', 'disabled', 'error'];
  const fixture = states.includes(query.state as VideoFixture) ? query.state as VideoFixture : 'ready';
  const nav = lang === 'ar' ? ['نظرة عامة', 'المستخدمون', 'الاشتراكات', 'المدفوعات', 'الاتصالات', 'التقارير', 'سجل التدقيق', 'فيديو كيف يعمل', 'الإعدادات'] : ['Overview', 'Users', 'Subscriptions', 'Payments', 'Connections', 'Reports', 'Audit log', 'How It Works Video', 'Settings'];
  const icons = [BarChart3, Users, ShieldCheck, CreditCard, Link2, FileText, ShieldCheck, Video, Settings];
  return <main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#06090c] text-white"><header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-[1500px] items-center justify-between"><Image src="/brand/design-preview-logo.png" alt="iSaudi.ai" width={120} height={34} className="h-8 w-auto" /><span className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400">QA · {lang.toUpperCase()} · {fixture}</span></div></header><div className="mx-auto grid max-w-[1500px] lg:grid-cols-[260px_1fr]"><aside className="hidden min-h-[calc(100vh-73px)] border-e border-white/10 bg-[#081017] p-5 lg:block"><div className="mb-5 rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-sm">admin@isaudi.ai</p><p className="mt-1 text-xs uppercase text-teal-400">super admin</p></div><nav className="space-y-2">{nav.map((item, index) => { const Icon = icons[index]; return <div key={item} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${index === 7 ? 'bg-[#d7b568] font-semibold text-[#071018]' : 'text-slate-400'}`}><Icon className="h-4 w-4" />{item}</div>; })}</nav></aside><section className="min-w-0 px-4 py-8 sm:px-8 lg:px-10 lg:py-10"><AdminVideoManager lang={lang} fixture={fixture} /></section></div></main>;
}
