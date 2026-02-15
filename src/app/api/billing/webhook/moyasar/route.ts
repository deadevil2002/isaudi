import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { randomUUID } from 'crypto';

const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Moyasar sends the payment object directly
    const paymentId = payload.id;
    const status = payload.status;

    if (!paymentId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Verify status with Moyasar API
    let verifiedPayment = payload;
    
    if (MOYASAR_SECRET_KEY) {
      const res = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(MOYASAR_SECRET_KEY + ':').toString('base64')}`
        }
      });
      
      if (res.ok) {
        verifiedPayment = await res.json();
      } else {
        console.error('Failed to verify payment with Moyasar');
        // If we can't verify, we shouldn't trust it. 
        // But for this exercise, if env is set but fetch fails, we abort.
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
      }
    }

    // Process only if paid
    if (verifiedPayment.status === 'paid') {
      const metadata = verifiedPayment.metadata || {};
      const userId = metadata.user_id;
      const planId = metadata.plan_id;
      const interval = metadata.interval;

      if (userId && planId && interval) {
        const now = Date.now();
        // month = 30 days, year = 365 days
        const duration = interval === 'year' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        const expiresAt = now + duration;

        // 1. Record Payment
        dbService.createPayment({
          id: verifiedPayment.id,
          userId,
          provider: 'moyasar',
          providerPaymentId: verifiedPayment.id,
          amountHalala: verifiedPayment.amount,
          currency: verifiedPayment.currency,
          status: 'paid',
          createdAt: now,
          rawJson: JSON.stringify(verifiedPayment)
        });

        // 2. Create/Update Subscription
        const subscriptionId = randomUUID();
        dbService.createSubscription({
          id: subscriptionId,
          userId,
          planId,
          interval,
          status: 'active',
          startedAt: now,
          expiresAt,
          createdAt: now
        });

        // 3. Update User Plan
        dbService.updateUserPlan(userId, planId, expiresAt);
        
        console.log(`Subscription activated for user ${userId}: ${planId} (${interval})`);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
