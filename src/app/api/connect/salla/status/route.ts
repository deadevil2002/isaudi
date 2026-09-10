import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { dbService } from '@/lib/db/service';
import { getSallaConnectState } from '@/lib/salla/repository';

export async function GET() {
  const sessionId = (await cookies()).get('session_id')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await dbService.getSession(sessionId);
  const user = session ? await dbService.getUserById(session.userId) : null;
  if (!session || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const state = await getSallaConnectState(user.id, user.email);
  return NextResponse.json(
    { state },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}