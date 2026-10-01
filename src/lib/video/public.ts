import 'server-only';
import { getD1Database } from '@/lib/db/d1';
import type { D1 } from '@/lib/admin/db';
import { publicYouTubeVideo, type PublicYouTubeVideo } from './youtube';

export type PublicVideo = PublicYouTubeVideo;

let cached: { value: PublicVideo; expiresAt: number } | null = null;
let pending: Promise<PublicVideo> | null = null;

async function loadPublicVideo(): Promise<PublicVideo> {
  try {
    const db = getD1Database() as D1 | null;
    if (!db) return { status: 'unavailable' };
    const row = await db.prepare(`SELECT youtube_video_id, enabled
      FROM how_it_works_video WHERE id = 1`).first<{ youtube_video_id: string | null; enabled: number }>();
    return publicYouTubeVideo(row);
  } catch (error) {
    console.error(JSON.stringify({ event: 'public_video_error', error: error instanceof Error ? error.name : 'UnknownError' }));
    return { status: 'error' };
  }
}

export async function getPublicHowItWorksVideo(): Promise<PublicVideo> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (pending) return pending;
  pending = loadPublicVideo().then(value => {
    cached = { value, expiresAt: Date.now() + (value.status === 'ready' ? 15_000 : 5_000) };
    return value;
  }).finally(() => { pending = null; });
  return pending;
}
