import 'server-only';
import { getD1Database } from '@/lib/db/d1';
import type { D1 } from '@/lib/admin/db';
import { createPlaybackUrl } from './stream';

export type PublicVideo = { status: 'ready'; playbackUrl: string } | { status: 'unavailable' | 'error' };

export async function getPublicHowItWorksVideo(): Promise<PublicVideo> {
  try {
    const db = getD1Database() as D1 | null;
    if (!db) return { status: 'unavailable' };
    const row = await db.prepare('SELECT active_uid FROM how_it_works_video WHERE id = 1').first<{ active_uid: string | null }>();
    if (!row?.active_uid) return { status: 'unavailable' };
    return { status: 'ready', playbackUrl: await createPlaybackUrl(row.active_uid) };
  } catch (error) {
    console.error('How It Works video unavailable', error instanceof Error ? error.name : 'UnknownError');
    return { status: 'error' };
  }
}
