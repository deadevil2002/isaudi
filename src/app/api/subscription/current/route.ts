import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getUserEntitlements } from '@/lib/subscription/service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const entitlements = await getUserEntitlements(user.id);

  return NextResponse.json({
    ok: true,
    subscription: entitlements,
  });
}