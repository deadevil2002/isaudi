-- Phase 6D: verified conversions and immutable commission snapshots.
-- Existing offers intentionally remain without a commission basis until an Admin configures one.

ALTER TABLE partner_offers ADD COLUMN commission_basis TEXT
  CHECK (commission_basis IS NULL OR commission_basis IN (
    'first_payment', 'service_value', 'order_value', 'contract_value', 'custom'
  ));

CREATE TABLE referral_conversions (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  finding_code TEXT NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'submitted', 'verified', 'rejected', 'cancelled'
  )),
  source TEXT NOT NULL CHECK (source IN (
    'partner_webhook', 'partner_callback', 'tracked_lead', 'manual_admin_verification'
  )),
  external_reference TEXT NOT NULL,
  converted_at INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL,
  verified_at INTEGER,
  verified_by_admin_id TEXT,
  rejected_at INTEGER,
  rejected_by_admin_id TEXT,
  cancelled_at INTEGER,
  cancelled_by_admin_id TEXT,
  amount_halala INTEGER CHECK (amount_halala IS NULL OR amount_halala >= 0),
  currency TEXT CHECK (currency IS NULL OR (length(currency) = 3 AND currency = upper(currency))),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((amount_halala IS NULL AND currency IS NULL) OR
    (amount_halala IS NOT NULL AND currency IS NOT NULL)),
  FOREIGN KEY(referral_id, user_id, merchant_id, analysis_id, finding_code,
    service_category_id, partner_offer_id)
    REFERENCES service_referrals(id, user_id, merchant_id, analysis_id, finding_code,
      service_category_id, partner_offer_id),
  FOREIGN KEY(verified_by_admin_id) REFERENCES admin_accounts(id),
  FOREIGN KEY(rejected_by_admin_id) REFERENCES admin_accounts(id),
  FOREIGN KEY(cancelled_by_admin_id) REFERENCES admin_accounts(id),
  UNIQUE(partner_offer_id, external_reference)
);

CREATE INDEX idx_referral_conversions_admin_time
  ON referral_conversions(created_at DESC, status, service_category_id, partner_offer_id);
CREATE INDEX idx_referral_conversions_scope
  ON referral_conversions(user_id, merchant_id, created_at DESC);

CREATE TABLE referral_commissions (
  id TEXT PRIMARY KEY,
  conversion_id TEXT NOT NULL UNIQUE,
  referral_id TEXT NOT NULL UNIQUE,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'not_eligible', 'pending', 'earned', 'approved', 'paid', 'cancelled'
  )),
  commission_type_snapshot TEXT NOT NULL CHECK (commission_type_snapshot IN ('percentage', 'fixed')),
  commission_rate_bps_snapshot INTEGER
    CHECK (commission_rate_bps_snapshot IS NULL OR
      commission_rate_bps_snapshot BETWEEN 0 AND 10000),
  fixed_amount_halala_snapshot INTEGER
    CHECK (fixed_amount_halala_snapshot IS NULL OR fixed_amount_halala_snapshot >= 0),
  commission_basis_snapshot TEXT NOT NULL CHECK (commission_basis_snapshot IN (
    'first_payment', 'service_value', 'order_value', 'contract_value', 'custom'
  )),
  base_amount_halala INTEGER CHECK (base_amount_halala IS NULL OR base_amount_halala >= 0),
  commission_amount_halala INTEGER NOT NULL CHECK (commission_amount_halala >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  earned_at INTEGER,
  approved_at INTEGER,
  approved_by_admin_id TEXT,
  paid_at INTEGER,
  cancelled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(conversion_id) REFERENCES referral_conversions(id),
  FOREIGN KEY(referral_id) REFERENCES service_referrals(id),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id),
  FOREIGN KEY(approved_by_admin_id) REFERENCES admin_accounts(id)
);

CREATE INDEX idx_referral_commissions_admin_time
  ON referral_commissions(created_at DESC, status, service_category_id, partner_offer_id);

CREATE TABLE referral_conversion_daily_metrics (
  day_start INTEGER NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  conversions_count INTEGER NOT NULL DEFAULT 0 CHECK (conversions_count >= 0),
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  verified_count INTEGER NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  cancelled_count INTEGER NOT NULL DEFAULT 0 CHECK (cancelled_count >= 0),
  PRIMARY KEY (
    day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id
  ),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id)
);

CREATE INDEX idx_referral_conversion_metrics_period
  ON referral_conversion_daily_metrics(day_start DESC);

CREATE TABLE referral_commission_daily_metrics (
  day_start INTEGER NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  earned_halala INTEGER NOT NULL DEFAULT 0 CHECK (earned_halala >= 0),
  approved_halala INTEGER NOT NULL DEFAULT 0 CHECK (approved_halala >= 0),
  paid_halala INTEGER NOT NULL DEFAULT 0 CHECK (paid_halala >= 0),
  PRIMARY KEY (
    day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id, currency
  )
);

CREATE INDEX idx_referral_commission_metrics_period
  ON referral_commission_daily_metrics(day_start DESC, currency);

CREATE TRIGGER referral_conversion_metrics_insert
AFTER INSERT ON referral_conversions
BEGIN
  INSERT INTO referral_conversion_daily_metrics (
    day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id,
    conversions_count, pending_count, verified_count, rejected_count, cancelled_count
  ) VALUES (
    CAST(NEW.created_at / 86400000 AS INTEGER) * 86400000,
    NEW.service_category_id, NEW.partner_offer_id, NEW.plan_snapshot, NEW.merchant_id,
    1, NEW.status IN ('pending', 'submitted'), NEW.status = 'verified',
    NEW.status = 'rejected', NEW.status = 'cancelled'
  )
  ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id)
  DO UPDATE SET
    conversions_count = conversions_count + 1,
    pending_count = pending_count + excluded.pending_count,
    verified_count = verified_count + excluded.verified_count,
    rejected_count = rejected_count + excluded.rejected_count,
    cancelled_count = cancelled_count + excluded.cancelled_count;
END;

CREATE TRIGGER referral_conversion_metrics_status_update
AFTER UPDATE OF status ON referral_conversions
WHEN OLD.status <> NEW.status
BEGIN
  UPDATE referral_conversion_daily_metrics SET
    pending_count = pending_count - (OLD.status IN ('pending', 'submitted'))
      + (NEW.status IN ('pending', 'submitted')),
    verified_count = verified_count - (OLD.status = 'verified') + (NEW.status = 'verified'),
    rejected_count = rejected_count - (OLD.status = 'rejected') + (NEW.status = 'rejected'),
    cancelled_count = cancelled_count - (OLD.status = 'cancelled') + (NEW.status = 'cancelled')
  WHERE day_start = CAST(NEW.created_at / 86400000 AS INTEGER) * 86400000
    AND service_category_id = NEW.service_category_id
    AND partner_offer_id = NEW.partner_offer_id
    AND plan_snapshot = NEW.plan_snapshot
    AND merchant_id = NEW.merchant_id;
END;

CREATE TRIGGER referral_commission_metrics_insert
AFTER INSERT ON referral_commissions
BEGIN
  INSERT INTO referral_commission_daily_metrics (
    day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id,
    currency, earned_halala, approved_halala, paid_halala
  ) SELECT CAST(x.created_at / 86400000 AS INTEGER) * 86400000,
    NEW.service_category_id, NEW.partner_offer_id, NEW.plan_snapshot, x.merchant_id,
    NEW.currency,
    CASE WHEN NEW.status = 'earned' THEN NEW.commission_amount_halala ELSE 0 END,
    CASE WHEN NEW.status = 'approved' THEN NEW.commission_amount_halala ELSE 0 END,
    CASE WHEN NEW.status = 'paid' THEN NEW.commission_amount_halala ELSE 0 END
  FROM referral_conversions x WHERE x.id=NEW.conversion_id
  ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot, merchant_id, currency)
  DO UPDATE SET
    earned_halala = earned_halala + excluded.earned_halala,
    approved_halala = approved_halala + excluded.approved_halala,
    paid_halala = paid_halala + excluded.paid_halala;
END;

CREATE TRIGGER referral_commission_metrics_status_update
AFTER UPDATE OF status ON referral_commissions
WHEN OLD.status <> NEW.status
BEGIN
  UPDATE referral_commission_daily_metrics SET
    earned_halala = earned_halala
      - CASE WHEN OLD.status = 'earned' THEN OLD.commission_amount_halala ELSE 0 END
      + CASE WHEN NEW.status = 'earned' THEN NEW.commission_amount_halala ELSE 0 END,
    approved_halala = approved_halala
      - CASE WHEN OLD.status = 'approved' THEN OLD.commission_amount_halala ELSE 0 END
      + CASE WHEN NEW.status = 'approved' THEN NEW.commission_amount_halala ELSE 0 END,
    paid_halala = paid_halala
      - CASE WHEN OLD.status = 'paid' THEN OLD.commission_amount_halala ELSE 0 END
      + CASE WHEN NEW.status = 'paid' THEN NEW.commission_amount_halala ELSE 0 END
  WHERE day_start = (
      SELECT CAST(created_at / 86400000 AS INTEGER) * 86400000
      FROM referral_conversions WHERE id = NEW.conversion_id
    )
    AND service_category_id = NEW.service_category_id
    AND partner_offer_id = NEW.partner_offer_id
    AND plan_snapshot = NEW.plan_snapshot
    AND merchant_id = (
      SELECT merchant_id FROM referral_conversions WHERE id = NEW.conversion_id
    ) AND currency = NEW.currency;
END;
