import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';

type Interval = 'month' | 'year';
const ALLOWED_PLANS = new Set(['starter', 'growth', 'enterprise']);
const ALLOWED_INTERVALS = new Set<Interval>(['month', 'year']);

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const planId = typeof payload?.planId === 'string' ? payload.planId : '';
    const interval = (typeof payload?.interval === 'string' ? payload.interval : '') as Interval;

    if (!ALLOWED_PLANS.has(planId)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!ALLOWED_INTERVALS.has(interval)) {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 });
    }

    // Minimal working implementation to avoid 404s and allow UI flow.
    // Real Tap checkout session creation can be added later.
    const fallbackRedirect = '/billing?status=processed';
    return NextResponse.json(
      {
        ok: true,
        redirectUrl: fallbackRedirect,
        planId,
        interval,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

