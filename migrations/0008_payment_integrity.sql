ALTER TABLE payments ADD COLUMN planId TEXT;
ALTER TABLE payments ADD COLUMN interval TEXT;
ALTER TABLE payments ADD COLUMN updatedAt INTEGER;
ALTER TABLE payments ADD COLUMN processedAt INTEGER;
ALTER TABLE payments ADD COLUMN integrityError TEXT;
ALTER TABLE payments ADD COLUMN processingToken TEXT;
ALTER TABLE payments ADD COLUMN receiptClaimedAt INTEGER;
ALTER TABLE payments ADD COLUMN receiptLeaseToken TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_id
  ON payments(provider, providerPaymentId)
  WHERE providerPaymentId IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_status
  ON payments(userId, status, createdAt);