import { NextResponse } from 'next/server';
import { getPublicHowItWorksVideo } from '@/lib/video/public';

export const dynamic = 'force-dynamic';

export async function GET() {
  const response = NextResponse.json(await getPublicHowItWorksVideo());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
