-- Add columns to payments table for idempotent receipt emails
ALTER TABLE payments ADD COLUMN receiptEmailSentAt INTEGER NULL;
ALTER TABLE payments ADD COLUMN receiptEmailId TEXT NULL;
