import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getSallaConnectState } from '@/lib/salla/repository';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const state = await getSallaConnectState(String(user.id));
  return NextResponse.json(
    { state },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}