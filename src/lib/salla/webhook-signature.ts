import { createHmac, timingSafeEqual } from 'crypto';

export function verifySallaWebhookSignature(
  rawBody: string,
  suppliedSignature: string | null,
  secret: string
): boolean {
  if (!suppliedSignature || !secret || !/^[a-fA-F0-9]{64}$/.test(suppliedSignature)) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const suppliedBuffer = Buffer.from(suppliedSignature.toLowerCase(), 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}