'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Film, PlayCircle, Link2, BarChart3, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import type { PublicVideo } from '@/lib/video/public';
import { youtubeEmbedUrl } from '@/lib/video/youtube';

export function HowItWorksPageContent({ video: initialVideo, previewLoading = false, loadPublicVideo = false }: { video: PublicVideo; previewLoading?: boolean; loadPublicVideo?: boolean }) {
  const { lang } = useLanguage();
  const [video, setVideo] = useState(initialVideo);
  const [fetching, setFetching] = useState(loadPublicVideo);
  const [loaded, setLoaded] = useState(false);
  const ar = lang === 'ar';

  useEffect(() => {
    if (!loadPublicVideo) return;
    let active = true;
    fetch('/api/public/how-it-works-video', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<PublicVideo> : Promise.reject())
      .then(value => { if (active) { setLoaded(false); setVideo(value); } })
      .catch(() => { if (active) setVideo({ status: 'error' }); })
      .finally(() => { if (active) setFetching(false); });
    return () => { active = false; };
  }, [loadPublicVideo]);

  return <main dir={ar ? 'rtl' : 'ltr'} className="isaudi-grid-bg relative min-h-screen overflow-hidden bg-[#06090c] px-4 py-8 text-white sm:px-6 sm:py-10">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_50%_0%,rgba(25,119,108,.2),transparent_55%)]" />
    <div className="relative mx-auto max-w-6xl">
      <header className="flex items-center justify-between">
        <Link href="/"><Image src="/brand/design-preview-logo.png" alt="iSaudi.ai" width={138} height={42} priority className="h-10 w-auto object-contain" /></Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-slate-300 transition hover:bg-white/5">
          <ArrowLeft className={`h-4 w-4 ${!ar ? 'rotate-180' : ''}`} />{ar ? 'العودة للرئيسية' : 'Back home'}
        </Link>
      </header>
      <section className="mx-auto max-w-3xl pb-8 pt-14 text-center sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[.24em] text-[#d7b568]">{ar ? 'iSaudi.ai في دقائق' : 'iSaudi.ai in minutes'}</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{ar ? 'شاهد كيف يحوّل iSaudi بياناتك إلى قرارات أوضح' : 'See how iSaudi turns your data into clearer decisions'}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">{ar ? 'جولة مختصرة توضّح تجربة الربط والتحليل والوصول إلى رؤى عملية.' : 'A focused walkthrough of connecting, analyzing, and reaching practical insights.'}</p>
      </section>
      <ol className="mx-auto mb-6 grid max-w-4xl gap-3 sm:grid-cols-3" aria-label={ar ? 'مراحل عمل المنصة' : 'How the platform works'}>
        {[
          { icon: Link2, ar: 'اربط متجرك بأمان', en: 'Connect your store securely' },
          { icon: BarChart3, ar: 'نحلّل بياناتك الفعلية', en: 'We analyze your real data' },
          { icon: Lightbulb, ar: 'تحصل على قرارات عملية', en: 'Receive actionable decisions' },
        ].map(({ icon: Icon, ar: arLabel, en }, index) => (
          <li key={en} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-start">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#20d4b2]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-[#e6b95c]">{String(index + 1).padStart(2, '0')}</span><span className="mt-1 block text-sm font-semibold text-[#dce3eb]">{ar ? arLabel : en}</span></div>
          </li>
        ))}
      </ol>
      <section className="isaudi-card overflow-hidden rounded-[1.75rem]">
        {fetching ? <div className="flex min-h-72 items-center justify-center sm:aspect-video"><PlayCircle className="h-10 w-10 animate-pulse text-[#d7b568] motion-reduce:animate-none" /></div> : video.status === 'ready' ? <div className="relative aspect-video bg-black">
          {(!loaded || previewLoading) && <div className="absolute inset-0 z-10 grid place-items-center bg-[#091118] transition-opacity duration-300 motion-reduce:transition-none"><div className="text-center"><PlayCircle className="mx-auto h-10 w-10 animate-pulse text-[#d7b568] motion-reduce:animate-none" /><p className="mt-3 text-sm text-slate-400">{ar ? 'جارٍ تجهيز المشغّل…' : 'Preparing the player…'}</p></div></div>}
          <iframe title={ar ? 'فيديو كيف يعمل iSaudi' : 'How iSaudi works'} src={youtubeEmbedUrl(video.videoId)} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
        </div> : <div className="flex min-h-72 flex-col items-center justify-center overflow-hidden px-6 text-center sm:aspect-video">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-[#d7b568]"><Film className="h-7 w-7" /></span>
          <h2 className="mt-5 w-full min-w-0 break-words text-lg font-semibold sm:text-xl">{ar ? 'الفيديو غير متاح حالياً' : 'Video currently unavailable'}</h2>
          <p className="mt-2 w-full min-w-0 max-w-md text-sm leading-6 text-slate-400">{ar ? 'نعمل على تجهيز الجولة التعريفية. يمكنك البدء الآن واستكشاف المنصة.' : 'We are preparing the walkthrough. You can still get started and explore the platform.'}</p>
        </div>}
      </section>
      <div className="mt-8 flex justify-center"><Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#d7b568] px-7 font-semibold text-[#071018] transition hover:bg-[#ecd08a] motion-reduce:transition-none">{ar ? 'ابدأ الآن' : 'Get started'}</Link></div>
    </div>
  </main>;
}
