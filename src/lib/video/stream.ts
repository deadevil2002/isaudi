import 'server-only';

import { getRuntimeString } from '@/lib/runtime/environment';

const STREAM_API = 'https://api.cloudflare.com/client/v4';
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 15 * 60;
const UPLOAD_EXPIRY_MS = 15 * 60 * 1000;

type CloudflareEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

type StreamConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
};

export type StreamVideoState = {
  ready: boolean;
  state: 'ready' | 'processing' | 'error';
  error: string | null;
};

export class StreamConfigurationError extends Error {
  constructor() {
    super('Cloudflare Stream is not configured');
    this.name = 'StreamConfigurationError';
  }
}

function config(): StreamConfig {
  const accountId = getRuntimeString('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = getRuntimeString('CLOUDFLARE_STREAM_API_TOKEN');
  const customerCode = getRuntimeString('CLOUDFLARE_STREAM_CUSTOMER_CODE');
  if (!accountId || !apiToken || !customerCode) throw new StreamConfigurationError();
  return { accountId, apiToken, customerCode };
}

export function isStreamConfigured(): boolean {
  try { config(); return true; } catch { return false; }
}

function allowedOrigins(): string[] {
  const appUrl = getRuntimeString('APP_URL') || getRuntimeString('NEXT_PUBLIC_APP_URL') || 'https://isaudi.ai';
  try {
    const hostname = new URL(appUrl).hostname;
    return hostname === 'isaudi.ai' ? ['isaudi.ai', 'www.isaudi.ai'] : [hostname];
  } catch {
    return ['isaudi.ai'];
  }
}

async function cloudflare<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accountId, apiToken } = config();
  const response = await fetch(`${STREAM_API}/accounts/${accountId}/stream${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
  if (!response.ok || !payload?.success || !payload.result) {
    throw new Error(payload?.errors?.[0]?.message || 'Cloudflare Stream request failed');
  }
  return payload.result;
}

export function validateVideoMetadata(name: unknown, type: unknown, size: unknown) {
  const fileName = typeof name === 'string' ? name.trim() : '';
  const mime = typeof type === 'string' ? type.toLowerCase() : '';
  const bytes = typeof size === 'number' ? size : Number.NaN;
  const allowedMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
  if (!/\.(mp4|webm|mov)$/i.test(fileName) || !allowedMime.has(mime)) {
    throw new Error('unsupported_video_type');
  }
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_VIDEO_BYTES) {
    throw new Error('invalid_video_size');
  }
  return { fileName: fileName.slice(0, 120), mime, bytes };
}

export async function createDirectUpload(adminId: string, fileName: string) {
  return cloudflare<{ uploadURL: string; uid: string }>('/direct_upload', {
    method: 'POST',
    body: JSON.stringify({
      maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
      expiry: new Date(Date.now() + UPLOAD_EXPIRY_MS).toISOString(),
      allowedOrigins: allowedOrigins(),
      requireSignedURLs: true,
      creator: adminId.slice(0, 64),
      meta: { name: fileName, purpose: 'how-it-works' },
    }),
  });
}

export async function getStreamVideo(uid: string): Promise<StreamVideoState> {
  const result = await cloudflare<{
    readyToStream?: boolean;
    status?: { state?: string; errorReasonText?: string };
  }>(`/${encodeURIComponent(uid)}`);
  const rawState = result.status?.state || '';
  if (result.readyToStream || rawState === 'ready') return { ready: true, state: 'ready', error: null };
  if (rawState === 'error') return { ready: false, state: 'error', error: result.status?.errorReasonText || 'processing_error' };
  return { ready: false, state: 'processing', error: null };
}

export async function deleteStreamVideo(uid: string): Promise<void> {
  const { accountId, apiToken } = config();
  const response = await fetch(`${STREAM_API}/accounts/${accountId}/stream/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 404) throw new Error('Cloudflare Stream delete failed');
}

export async function createPlaybackUrl(uid: string): Promise<string> {
  const { customerCode } = config();
  const result = await cloudflare<{ token: string }>(`/${encodeURIComponent(uid)}/token`, { method: 'POST' });
  return `https://customer-${customerCode}.cloudflarestream.com/${result.token}/iframe?preload=metadata`;
}
