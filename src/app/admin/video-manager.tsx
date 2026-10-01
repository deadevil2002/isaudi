'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, CircleOff, Film, Link2, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { parseYouTubeVideoUrl, youtubeEmbedUrl } from '@/lib/video/youtube';

type VideoState = {
  active: boolean;
  videoId: string | null;
  youtubeUrl: string | null;
  embedUrl: string | null;
  updatedAt?: number | null;
};

export type VideoFixture = 'none' | 'saving' | 'ready' | 'disabled' | 'error';

const copy = {
  ar: {
    title: 'فيديو كيف يعمل', description: 'أضف رابط فيديو YouTube غير مدرج لعرضه للزوار في صفحة كيف يعمل.',
    label: 'رابط فيديو كيف يعمل', placeholder: 'https://www.youtube.com/watch?v=VIDEO_ID', helper: 'يدعم روابط youtube.com/watch و youtu.be فقط. استخدم فيديو غير مدرج، وليس خاصاً.',
    save: 'حفظ', saving: 'جارٍ الحفظ…', replace: 'استبدال', current: 'الفيديو الحالي', active: 'نشط', disabled: 'معطّل', none: 'لا يوجد فيديو محفوظ',
    disable: 'تعطيل', enable: 'تفعيل مجدداً', remove: 'إزالة', invalid: 'أدخل رابط فيديو YouTube صالحاً.', saved: 'تم حفظ الفيديو بنجاح.',
    disabledDone: 'تم تعطيل الفيديو.', removed: 'تمت إزالة الفيديو.', preview: 'معاينة الفيديو الحالي', privacy: 'الفيديو غير المدرج لا يظهر عادةً في بحث YouTube، لكن أي شخص يملك الرابط يستطيع مشاركته أو مشاهدته.',
  },
  en: {
    title: 'How It Works Video', description: 'Add an unlisted YouTube video for visitors to watch on the How It Works page.',
    label: 'How It Works video URL', placeholder: 'https://www.youtube.com/watch?v=VIDEO_ID', helper: 'Only youtube.com/watch and youtu.be links are accepted. Use an unlisted video, not a private one.',
    save: 'Save', saving: 'Saving…', replace: 'Replace', current: 'Current video', active: 'Active', disabled: 'Disabled', none: 'No video saved',
    disable: 'Disable', enable: 'Enable again', remove: 'Remove', invalid: 'Enter a valid YouTube video URL.', saved: 'Video saved successfully.',
    disabledDone: 'Video disabled.', removed: 'Video removed.', preview: 'Current video preview', privacy: 'An unlisted video is normally absent from YouTube search, but anyone with the link can watch or share it.',
  },
};

async function jsonApi(action: string, payload?: Record<string, unknown>) {
  const response = await fetch(`/admin/api/${action}`, {
    method: payload ? 'POST' : 'GET', credentials: 'same-origin',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result as VideoState & { success?: boolean };
}

export function AdminVideoManager({ lang = 'ar', fixture }: { lang?: 'ar' | 'en'; fixture?: VideoFixture }) {
  const t = copy[lang];
  const [state, setState] = useState<VideoState | null>(fixture ? fixtureState(fixture) : null);
  const [url, setUrl] = useState(state?.youtubeUrl ?? '');
  const [busy, setBusy] = useState(fixture === 'saving');
  const [error, setError] = useState(fixture === 'error' ? t.invalid : '');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (fixture) return;
    let live = true;
    jsonApi('video')
      .then(next => { if (live) { setState(next); setUrl(next.youtubeUrl ?? ''); } })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'Request failed'); });
    return () => { live = false; };
  }, [fixture]);

  async function refresh(message: string) {
    const next = await jsonApi('video');
    setState(next); setUrl(next.youtubeUrl ?? ''); setNotice(message);
  }

  async function persist(candidate: string) {
    try { parseYouTubeVideoUrl(candidate); } catch { setError(t.invalid); return; }
    if (fixture) { setState(fixtureState('ready')); setNotice(t.saved); return; }
    setBusy(true);
    try { await jsonApi('video-save', { youtubeUrl: candidate }); await refresh(t.saved); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    await persist(url);
  }

  async function disable() {
    if (fixture) { setState(current => current ? { ...current, active: false } : current); setNotice(t.disabledDone); return; }
    setBusy(true); setError(''); setNotice('');
    try { await jsonApi('video-disable', { confirm: true }); await refresh(t.disabledDone); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }

  async function enable() {
    if (!state?.youtubeUrl) return;
    setError(''); setNotice('');
    await persist(state.youtubeUrl);
  }

  async function remove() {
    if (!window.confirm(lang === 'ar' ? 'إزالة رابط الفيديو نهائياً؟' : 'Remove the saved video URL?')) return;
    if (fixture) { setState(fixtureState('none')); setUrl(''); setNotice(t.removed); return; }
    setBusy(true); setError(''); setNotice('');
    try { await jsonApi('video-remove', { confirm: true }); await refresh(t.removed); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }

  const hasVideo = Boolean(state?.videoId);
  const previewUrl = state?.videoId ? youtubeEmbedUrl(state.videoId) : null;

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-semibold text-white">{t.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t.description}</p></div>
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d151d] shadow-2xl shadow-black/20">
      <form onSubmit={save} className="space-y-4 border-b border-white/10 p-5 sm:p-7">
        <label htmlFor="youtube-video-url" className="block text-sm font-semibold text-white">{t.label}</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2 aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input id="youtube-video-url" name="youtubeUrl" type="url" inputMode="url" autoComplete="url" dir="ltr" required value={url} onChange={event => setUrl(event.target.value)} aria-describedby="youtube-video-help youtube-video-error" placeholder={t.placeholder} className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 ps-12 text-left text-base text-white outline-none transition placeholder:text-slate-600 focus:border-[#d7b568]/70 focus:ring-2 focus:ring-[#d7b568]/15" />
          </div>
          <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#d7b568] px-6 font-semibold text-[#071018] transition hover:bg-[#ecd08a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d994] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d151d] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
            {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}{busy ? t.saving : hasVideo ? t.replace : t.save}
          </button>
        </div>
        <p id="youtube-video-help" className="text-xs leading-5 text-slate-500">{t.helper}</p>
        {error && <p id="youtube-video-error" role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" aria-live="polite" className="text-sm text-teal-300">{notice}</p>}
      </form>

      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="min-w-0"><p className="text-xs uppercase tracking-[.18em] text-slate-500">{t.current}</p><p className="mt-1 flex items-center gap-2 text-sm font-medium text-white">{state?.active ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-teal-400" /> : <CircleOff aria-hidden="true" className="h-4 w-4 text-slate-500" />}{hasVideo ? state?.active ? t.active : t.disabled : t.none}</p>{state?.youtubeUrl && <p dir="ltr" className="mt-2 max-w-xl overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs text-slate-500" title={state.youtubeUrl}>{state.youtubeUrl}</p>}</div>
        {hasVideo && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={state?.active ? disable : enable} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-50 motion-reduce:transition-none">{state?.active ? t.disable : t.enable}</button><button type="button" disabled={busy} onClick={remove} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/20 px-4 text-sm text-red-200 transition hover:bg-red-400/10 disabled:opacity-50 motion-reduce:transition-none"><Trash2 aria-hidden="true" className="h-4 w-4" />{t.remove}</button></div>}
      </div>

      {previewUrl && state?.active ? <div className="aspect-video bg-black"><iframe title={t.preview} src={previewUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div> : <div className="flex min-h-64 flex-col items-center justify-center border-t border-white/10 px-6 text-center sm:aspect-video"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-[#d7b568]"><Film aria-hidden="true" className="h-7 w-7" /></span><p className="mt-4 text-sm text-slate-400">{hasVideo ? t.disabled : t.none}</p></div>}
      <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-7">{t.privacy}</p>
    </section>
  </div>;
}

function fixtureState(state: VideoFixture): VideoState {
  const hasVideo = state !== 'none' && state !== 'error';
  return {
    active: state === 'ready' || state === 'saving',
    videoId: hasVideo ? 'aqz-KE-bpKQ' : null,
    youtubeUrl: hasVideo ? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' : null,
    embedUrl: hasVideo ? youtubeEmbedUrl('aqz-KE-bpKQ') : null,
  };
}
