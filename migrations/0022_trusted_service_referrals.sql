-- Phase 6C: deterministic, tenant-scoped trusted service referrals.
-- Categories and offers are Admin-controlled. No partner offer is seeded.

CREATE TABLE service_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  minimum_confidence TEXT NOT NULL DEFAULT 'high'
    CHECK (minimum_confidence IN ('low', 'medium', 'high')),
  minimum_severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (minimum_severity IN ('low', 'medium', 'high', 'critical')),
  max_referrals_per_analysis INTEGER NOT NULL DEFAULT 1
    CHECK (max_referrals_per_analysis BETWEEN 1 AND 5),
  created_by_admin_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_accounts(id)
);

INSERT INTO service_categories (
  id, slug, name_ar, name_en, description_ar, description_en, active,
  minimum_confidence, minimum_severity, max_referrals_per_analysis,
  created_by_admin_id, created_at, updated_at
) VALUES (
  'svc_landing_page_optimization',
  'landing_page_optimization',
  'تحسين صفحة المتجر',
  'Landing Page Optimization',
  'تنفيذ تحسينات صفحة المتجر المدعومة بأدلة iSaudi.',
  'Implement storefront improvements supported by iSaudi evidence.',
  0, 'high', 'medium', 1, NULL,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);

CREATE TABLE partner_offers (
  id TEXT PRIMARY KEY,
  service_category_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_url TEXT NOT NULL,
  service_title_ar TEXT NOT NULL,
  service_title_en TEXT NOT NULL,
  description_ar TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  supported_platforms_json TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
  commission_rate_bps INTEGER CHECK (commission_rate_bps BETWEEN 0 AND 10000),
  fixed_amount_halala INTEGER CHECK (fixed_amount_halala >= 0),
  commission_currency TEXT,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  display_priority INTEGER NOT NULL DEFAULT 100
    CHECK (display_priority BETWEEN 0 AND 10000),
  quality_status TEXT NOT NULL DEFAULT 'review'
    CHECK (quality_status IN ('approved', 'review', 'rejected')),
  created_by_admin_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (commission_type = 'percentage' AND commission_rate_bps IS NOT NULL
      AND fixed_amount_halala IS NULL AND commission_currency IS NULL)
    OR
    (commission_type = 'fixed' AND fixed_amount_halala IS NOT NULL
      AND commission_rate_bps IS NULL AND commission_currency IS NOT NULL)
  ),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_accounts(id),
  UNIQUE(id, service_category_id)
);

CREATE INDEX idx_partner_offers_selection
  ON partner_offers(service_category_id, status, quality_status, display_priority, created_at);

CREATE UNIQUE INDEX idx_landing_analysis_referral_identity
  ON landing_page_analyses(id, user_id, merchant_id);

CREATE TABLE service_referrals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  finding_code TEXT NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'eligible'
    CHECK (status IN ('eligible', 'shown', 'clicked', 'converted', 'cancelled')),
  source TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  commission_snapshot_json TEXT,
  commission_earned_halala INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (commission_earned_halala IS NULL OR commission_earned_halala >= 0),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(merchant_id) REFERENCES salla_connections(merchantId),
  FOREIGN KEY(analysis_id, user_id, merchant_id)
    REFERENCES landing_page_analyses(id, user_id, merchant_id),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id, service_category_id)
    REFERENCES partner_offers(id, service_category_id),
  UNIQUE(user_id, analysis_id, finding_code, service_category_id),
  UNIQUE(id, user_id, merchant_id, analysis_id, finding_code,
    service_category_id, partner_offer_id)
);

CREATE INDEX idx_service_referrals_owner_analysis
  ON service_referrals(user_id, analysis_id, created_at DESC);
CREATE INDEX idx_service_referrals_admin_time
  ON service_referrals(created_at DESC, service_category_id, partner_offer_id);

CREATE TABLE referral_events (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  finding_code TEXT NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('shown', 'clicked', 'contacted', 'converted', 'completed', 'cancelled', 'refunded')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(referral_id, user_id, merchant_id, analysis_id, finding_code,
    service_category_id, partner_offer_id)
    REFERENCES service_referrals(id, user_id, merchant_id, analysis_id,
      finding_code, service_category_id, partner_offer_id)
);

CREATE UNIQUE INDEX idx_referral_events_one_shown
  ON referral_events(referral_id, event_type)
  WHERE event_type = 'shown';
CREATE INDEX idx_referral_events_referral_time
  ON referral_events(referral_id, created_at DESC);
CREATE INDEX idx_referral_events_admin_time
  ON referral_events(event_type, created_at DESC);

CREATE TABLE referral_unique_clickers (
  referral_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  first_clicked_at INTEGER NOT NULL,
  PRIMARY KEY(referral_id, user_id),
  FOREIGN KEY(referral_id) REFERENCES service_referrals(id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id)
);

CREATE TABLE referral_daily_metrics (
  day_start INTEGER NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  referrals_count INTEGER NOT NULL DEFAULT 0,
  shown_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  unique_clickers_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day_start, service_category_id, partner_offer_id, plan_snapshot),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id)
);

CREATE INDEX idx_referral_daily_metrics_period
  ON referral_daily_metrics(day_start DESC);

CREATE TRIGGER referral_metrics_referral_insert
AFTER INSERT ON service_referrals BEGIN
  INSERT INTO referral_daily_metrics (
    day_start, service_category_id, partner_offer_id, plan_snapshot,
    referrals_count, shown_count, clicks_count, unique_clickers_count
  ) VALUES (
    (NEW.created_at / 86400000) * 86400000,
    NEW.service_category_id, NEW.partner_offer_id, NEW.plan_snapshot,
    1, 0, 0, 0
  ) ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
  DO UPDATE SET referrals_count = referrals_count + 1;
END;

CREATE TRIGGER referral_metrics_event_insert
AFTER INSERT ON referral_events BEGIN
  INSERT INTO referral_daily_metrics (
    day_start, service_category_id, partner_offer_id, plan_snapshot,
    referrals_count, shown_count, clicks_count, unique_clickers_count
  ) VALUES (
    (NEW.created_at / 86400000) * 86400000,
    NEW.service_category_id, NEW.partner_offer_id, NEW.plan_snapshot,
    0,
    CASE WHEN NEW.event_type = 'shown' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'clicked' THEN 1 ELSE 0 END,
    0
  ) ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
  DO UPDATE SET
    shown_count = shown_count + CASE WHEN NEW.event_type = 'shown' THEN 1 ELSE 0 END,
    clicks_count = clicks_count + CASE WHEN NEW.event_type = 'clicked' THEN 1 ELSE 0 END;
END;

CREATE TRIGGER referral_metrics_unique_clicker_insert
AFTER INSERT ON referral_unique_clickers BEGIN
  INSERT INTO referral_daily_metrics (
    day_start, service_category_id, partner_offer_id, plan_snapshot,
    referrals_count, shown_count, clicks_count, unique_clickers_count
  ) VALUES (
    (NEW.first_clicked_at / 86400000) * 86400000,
    NEW.service_category_id, NEW.partner_offer_id, NEW.plan_snapshot,
    0, 0, 0, 1
  ) ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
  DO UPDATE SET unique_clickers_count = unique_clickers_count + 1;
END;
