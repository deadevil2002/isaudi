import { NextRequest, NextResponse } from 'next/server';
import { getSallaEnvironment } from '@/lib/salla/environment';
import { verifySallaWebhookSignature } from '@/lib/salla/webhook-signature';

export async function POST(request: NextRequest) {
  try {
    const { SALLA_WEBHOOK_SECRET } = getSallaEnvironment();
    if (!SALLA_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook verification unavailable' },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-salla-signature');
    if (
      !verifySallaWebhookSignature(
        rawBody,
        signature,
        SALLA_WEBHOOK_SECRET
      )
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This is a scaffold. Real implementation needs Salla's specific event payloads.
    // Example: order.created, product.updated
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    if (!data) {
       return NextResponse.json({ success: true }); // Acknowledge anyway
    }

    // We need to know which user this store belongs to.
    // Salla webhooks usually include merchant_id or store_id.
    // We would need to map that to our userId. 
    // Since we didn't store merchant_id in store_connections, we can't map easily yet.
    // For this MVP, we will skip actual processing unless we can identify the user.
    
    // To fix this in production: Add merchantId to store_connections and look it up here.

    console.log(`Received Salla Webhook: ${event}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
