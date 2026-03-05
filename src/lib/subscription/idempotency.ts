import { getDb } from '@/lib/db/client';

export async function isPaymentProcessed(tapChargeId: string): Promise<boolean> {
  if (!tapChargeId) return false;
  const db = await getDb();
  const result = await db.prepare('SELECT 1 FROM payments WHERE tapChargeId = ? LIMIT 1').get(tapChargeId);
  return !!result;
}

export async function markPaymentProcessed(chargeId: string, provider: string, details: any): Promise<void> {
  // This function will be implemented in a later phase.
  // For now, it's a placeholder.
}
