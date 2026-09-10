import { NextRequest, NextResponse } from 'next/server';
import { getSallaEnvironment } from '@/lib/salla/environment';
import { verifySallaWebhookSignature } from '@/lib/salla/webhook-signature';
import {
  processSallaWebhook,
  SallaWebhookValidationError,
} from '@/lib/salla/webhook';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readTextWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';

export async function POST(request: NextRequest) {
  try {
    const { SALLA_WEBHOOK_SECRET } = getSallaEnvironment();
    if (!SALLA_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook verification unavailable' },
        { status: 500 }
      );
    }

    let rawBody: string;
    try {
      rawBody = await readTextWithLimit(request, REQUEST_BODY_LIMITS.webhook);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
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

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    try {
      await processSallaWebhook(payload);
    } catch (error) {
      if (error instanceof SallaWebhookValidationError) {
        return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });

  } catch {
    console.error('Salla webhook processing failed', { provider: 'salla' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
