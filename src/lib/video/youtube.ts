export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeVideoRow = {
  youtube_video_id: string | null;
  youtube_url?: string | null;
  enabled: number;
};

export type PublicYouTubeVideo =
  | { status: 'ready'; videoId: string }
  | { status: 'unavailable' | 'error' };

export function parseYouTubeVideoUrl(value: unknown): { videoId: string; canonicalUrl: string } {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 500) throw new Error('invalid_youtube_url');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid_youtube_url');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('invalid_youtube_url');
  }

  const host = url.hostname.toLowerCase();
  let videoId = '';
  if ((host === 'youtube.com' || host === 'www.youtube.com') && url.pathname === '/watch') {
    videoId = url.searchParams.get('v') || '';
  } else if (host === 'youtu.be') {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 1) videoId = segments[0];
  }

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) throw new Error('invalid_youtube_url');
  return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
}

export function youtubeEmbedUrl(videoId: string): string {
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) throw new Error('invalid_youtube_video_id');
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function publicYouTubeVideo(row: YouTubeVideoRow | null): PublicYouTubeVideo {
  return row?.enabled === 1 && row.youtube_video_id && YOUTUBE_VIDEO_ID_PATTERN.test(row.youtube_video_id)
    ? { status: 'ready', videoId: row.youtube_video_id }
    : { status: 'unavailable' };
}
