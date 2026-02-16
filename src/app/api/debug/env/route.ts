import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BUILD_ID, BUILD_ID_FALLBACK } from '@/lib/build-id';

export async function GET() {
  let env: any = null;
  try {
    const ctx = getCloudflareContext();
    env = (ctx as any)?.env ?? (ctx as any)?.context?.env ?? null;
  } catch {
    env = null;
  }

  const isCloudflare = Boolean(env) || Boolean((globalThis as any).Cloudflare);
  const buildId = BUILD_ID || BUILD_ID_FALLBACK;
  const emailEnv = isCloudflare
    ? {
        RESEND_API_KEY: env?.RESEND_API_KEY ?? null,
        RESEND_FROM: env?.RESEND_FROM ?? null,
      }
    : {
        RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
        RESEND_FROM: process.env.RESEND_FROM ?? null,
      };

  return NextResponse.json({
    ok: true,
    buildId,
    hasDB: !!env?.DB,
    hasResendKey: !!emailEnv.RESEND_API_KEY,
    hasResendFrom: !!emailEnv.RESEND_FROM,
    runtime:
      isCloudflare ? 'cloudflare' : 'local',
    envKeys: env ? Object.keys(env) : [],
  });
}
