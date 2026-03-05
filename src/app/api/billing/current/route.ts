import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { dbService } from '@/lib/db/service';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await dbService.getSubscriptionByUserId(user.id);

  return NextResponse.json({ ok: true, subscription });
}
