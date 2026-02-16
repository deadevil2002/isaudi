import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET() {
  let env: any = null;
  try {
    const ctx = getCloudflareContext();
    env = ctx?.env ?? null;
  } catch {
    env = null;
  }

  return NextResponse.json({
    ok: true,
    hasDB: !!env?.DB,
    hasResendKey: !!env?.RESEND_API_KEY,
    hasResendFrom: !!env?.RESEND_FROM,
    runtime:
      env?.DB || (globalThis as any).Cloudflare || process.env.NEXT_RUNTIME === 'edge'
        ? 'cloudflare'
        : 'local',
    envKeys: env ? Object.keys(env) : [],
  });
}
