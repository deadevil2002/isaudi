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
    envKeys: env ? Object.keys(env) : [],
  });
}
