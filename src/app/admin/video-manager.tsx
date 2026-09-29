'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Film, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';

type VideoState = {
  configured: boolean;
  active: { status: 'ready'; playbackUrl: string } | null;
  pending: { status: 'uploading' | 'processing' | 'error'; error?: string | null } | null;
  updatedAt?: number | null;
};

export type VideoFixture = 'none' | 'uploading' | 'processing' | 'ready' | 'replacement' | 'error';

const copy = {
  ar: { title: 'فيديو كيف يعمل', description: 'إدارة الفيديو التعريفي الظاهر للزوار بأمان عبر Cloudflare Stream.', current: 'الفيديو الحالي', none: 'لا يوجد فيديو منشور بعد', noneHelp: 'ارفع ملف فيديو لنشر تجربة مشاهدة احترافية للزوار.', choose: 'اختر فيديو', replace: 'استبدال الفيديو', uploading: 'جارٍ الرفع مباشرة إلى Stream', processing: 'يعالج Stream الفيديو الآن', processingHelp: 'سيبقى الفيديو الحالي منشوراً حتى تصبح النسخة الجديدة جاهزة.', ready: 'جاهز للنشر', error: 'تعذرت معالجة الفيديو', remove: 'إزالة الفيديو', confirmTitle: 'إزالة الفيديو الحالي؟', confirmBody: 'سيصبح الفيديو غير متاح للزوار. لا يمكن التراجع عن هذا الإجراء من لوحة الإدارة.', cancel: 'إلغاء', confirm: 'نعم، إزالة', configured: 'Stream غير مهيأ في هذه البيئة.', constraints: 'MP4 أو WebM أو MOV · حتى 200 MB · مدة قصوى 15 دقيقة', retry: 'اختر ملفاً آخر' },
  en: { title: 'How It Works Video', description: 'Securely manage the visitor explainer video through Cloudflare Stream.', current: 'Current video', none: 'No video is published yet', noneHelp: 'Upload a video to publish a premium viewing experience for visitors.', choose: 'Choose video', replace: 'Replace video', uploading: 'Uploading directly to Stream', processing: 'Stream is processing the video', processingHelp: 'The current video remains live until the replacement is ready.', ready: 'Ready', error: 'Video processing failed', remove: 'Remove video', confirmTitle: 'Remove the current video?', confirmBody: 'The video will become unavailable to visitors. This cannot be undone from Admin.', cancel: 'Cancel', confirm: 'Yes, remove', configured: 'Stream is not configured in this environment.', constraints: 'MP4, WebM, or MOV · up to 200 MB · 15-minute maximum', retry: 'Choose another file' },
};

async function jsonApi(action: string, payload?: Record<string, unknown>) {
  const response = await fetch(`/admin/api/${action}`, { method: payload ? 'POST' : 'GET', credentials: 'same-origin', headers: payload ? { 'Content-Type': 'application/json' } : undefined, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

export function AdminVideoManager({ lang = 'ar', fixture }: { lang?: 'ar' | 'en'; fixture?: VideoFixture }) {
  const t = copy[lang];
  const [state, setState] = useState<VideoState | null>(fixture ? fixtureState(fixture) : null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fixture) return;
    let live = true;
    const load = () => jsonApi('video').then((next) => { if (live) setState(next); }).catch((cause) => { if (live) setError(cause.message); });
    void load();
    const timer = window.setInterval(() => { if (state?.pending) void load(); }, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [fixture, state?.pending]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || fixture) return;
    setError(''); setProgress(1);
    try {
      const ticket = await jsonApi('video-upload', { fileName: file.name, fileType: file.type, fileSize: file.size });
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', ticket.uploadURL);
        request.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        request.onerror = () => reject(new Error('Upload failed'));
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Upload failed'));
        const body = new FormData(); body.append('file', file); request.send(body);
      });
      await jsonApi('video-uploaded', { uid: ticket.uid });
      setProgress(0); setState(await jsonApi('video'));
    } catch (cause) { setProgress(0); setError(cause instanceof Error ? cause.message : 'Upload failed'); }
    finally { event.target.value = ''; }
  }

  async function remove() {
    if (fixture) { setConfirming(false); return; }
    try { await jsonApi('video-remove', { confirm: true }); setState(await jsonApi('video')); setConfirming(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
  }

  const pending = progress ? 'uploading' : state?.pending?.status;
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-semibold text-white">{t.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{t.description}</p></div>
    {!fixture && state && !state.configured && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{t.configured}</div>}
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d151d] shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7"><div><p className="text-xs uppercase tracking-[.18em] text-slate-500">{t.current}</p><p className="mt-1 flex items-center gap-2 text-sm font-medium text-white">{state?.active ? <><CheckCircle2 className="h-4 w-4 text-teal-400" />{t.ready}</> : t.none}</p></div>{state?.active && <button onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/20 px-4 text-sm text-red-200 transition hover:bg-red-400/10"><Trash2 className="h-4 w-4" />{t.remove}</button>}</div>
      {state?.active ? <div className="aspect-video bg-black"><iframe title={t.current} src={state.active.playbackUrl} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div> : <div className="flex aspect-video flex-col items-center justify-center px-6 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-[#d7b568]"><Film className="h-7 w-7" /></span><p className="mt-5 font-medium text-white">{t.none}</p><p className="mt-2 max-w-md text-sm text-slate-400">{t.noneHelp}</p></div>}
      <div className="border-t border-white/10 p-5 sm:p-7">
        {pending && <div className={`mb-5 rounded-2xl border p-4 ${pending === 'error' ? 'border-red-400/20 bg-red-400/10' : 'border-teal-400/20 bg-teal-400/10'}`}><div className="flex items-center gap-3">{pending === 'error' ? <AlertTriangle className="h-5 w-5 text-red-300" /> : <LoaderCircle className="h-5 w-5 animate-spin text-teal-300 motion-reduce:animate-none" />}<div><p className="text-sm font-medium text-white">{pending === 'uploading' ? `${t.uploading}${progress ? ` · ${progress}%` : ''}` : pending === 'processing' ? t.processing : t.error}</p><p className="mt-1 text-xs text-slate-300">{pending === 'error' ? state?.pending?.error : t.processingHelp}</p></div></div>{progress > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-teal-400 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>}</div>}
        {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">{t.constraints}</p><button disabled={Boolean(pending && pending !== 'error') || (!fixture && state ? !state.configured : false)} onClick={() => input.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#d7b568] px-5 font-semibold text-[#071018] transition duration-300 hover:bg-[#ecd08a] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"><UploadCloud className="h-4 w-4" />{state?.active ? t.replace : pending === 'error' ? t.retry : t.choose}</button><input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime,.mov" className="sr-only" onChange={upload} /></div>
      </div>
    </section>
    {confirming && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101923] p-6 shadow-2xl"><h3 className="text-xl font-semibold text-white">{t.confirmTitle}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{t.confirmBody}</p><div className="mt-6 flex gap-3"><button onClick={() => setConfirming(false)} className="min-h-11 flex-1 rounded-xl border border-white/10 text-white">{t.cancel}</button><button onClick={remove} className="min-h-11 flex-1 rounded-xl bg-red-500 font-semibold text-white">{t.confirm}</button></div></div></div>}
  </div>;
}

function fixtureState(state: VideoFixture): VideoState {
  const active = state === 'ready' || state === 'replacement' ? { status: 'ready' as const, playbackUrl: 'about:blank' } : null;
  const pending = state === 'uploading' ? { status: 'uploading' as const } : state === 'processing' || state === 'replacement' ? { status: 'processing' as const } : state === 'error' ? { status: 'error' as const, error: 'Stream could not process this file.' } : null;
  return { configured: true, active, pending };
}
