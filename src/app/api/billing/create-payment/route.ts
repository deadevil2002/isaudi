import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';

const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY;

function resolveAppUrl(): string {
  const fallbackProd = 'https://isaudi.ai';
  const fallbackDev = 'http://localhost:3000';
  const appUrl = process.env.APP_URL ? process.env.APP_URL.trim() : '';
  const cfUrl = process.env.CF_PAGES_URL ? process.env.CF_PAGES_URL.trim() : '';
  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn('[config] APP_URL points to localhost while NODE_ENV=production');
  }
  const base =
    appUrl || cfUrl || (process.env.NODE_ENV === 'production' ? fallbackProd : fallbackDev);
  try {
    const url = new URL(base);
    return url.origin.replace(/\/+$/, '');
  } catch {
    return process.env.NODE_ENV === 'production' ? fallbackProd : fallbackDev;
  }
}

const PLANS: Record<string, { month: number; year: number }> = {
  basic: { month: 199, year: 1999 },
  pro: { month: 399, year: 3999 },
  business: { month: 899, year: 8999 },
};

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { planId, interval } = await request.json();

    if (!PLANS[planId] || !['month', 'year'].includes(interval)) {
      return NextResponse.json({ error: 'Invalid plan or interval' }, { status: 400 });
    }

    const amount = PLANS[planId][interval as 'month' | 'year'];
    const amountHalala = amount * 100;
    const description = `Subscription to ${planId} plan (${interval})`;
    const appUrl = resolveAppUrl();
    
    // In DEV, if no key, simulate success
    if (!MOYASAR_SECRET_KEY) {
      console.log(`[DEV] Mocking payment creation for ${user.email} - ${amount} SAR`);
      // Simulate a direct success redirect (in real app, this would go to payment page)
      // Since we can't easily mock the hosted page, we'll return a mock URL that 
      // redirects back to a success handler (or just the dashboard for simplicity in dev)
      return NextResponse.json({
        url: `${appUrl}/dashboard?payment_mock=success&plan=${planId}&interval=${interval}`
      });
    }

    // Call Moyasar Invoice API
    const response = await fetch('https://api.moyasar.com/v1/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(MOYASAR_SECRET_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        amount: amountHalala,
        currency: 'SAR',
        description: description,
        callback_url: `${appUrl}/billing?status=processed`,
        metadata: {
          user_id: user.id,
          plan_id: planId,
          interval: interval,
          email: user.email
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Moyasar Error:', errorText);
      return NextResponse.json({ error: 'Payment provider error' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ url: data.url });

  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
