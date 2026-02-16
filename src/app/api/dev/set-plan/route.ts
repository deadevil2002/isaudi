import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { dbService } from '@/lib/db/service';

const allowedPlans = ['free', 'starter', 'growth', 'business'];

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const plan = body?.plan as string | undefined;

    if (!plan || !allowedPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await dbService.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await dbService.getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbService.setUserPlanDev(user.id, plan);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dev set-plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
