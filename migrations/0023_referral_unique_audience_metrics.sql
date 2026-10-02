-- Exact period-scoped referral audience metrics.
-- Historical rows are backfilled only from recorded shown/clicked events.
CREATE TABLE referral_unique_audience (
  audience_kind TEXT NOT NULL CHECK (audience_kind IN ('viewer', 'clicker')),
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period_start INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  first_event_at INTEGER NOT NULL,
  PRIMARY KEY (
    audience_kind, period_kind, period_start, user_id,
    service_category_id, partner_offer_id, plan_snapshot
  ),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id)
);

CREATE TABLE referral_audience_metrics (
  audience_kind TEXT NOT NULL CHECK (audience_kind IN ('viewer', 'clicker')),
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period_start INTEGER NOT NULL,
  service_category_id TEXT NOT NULL,
  partner_offer_id TEXT NOT NULL,
  plan_snapshot TEXT NOT NULL,
  unique_users_count INTEGER NOT NULL DEFAULT 0 CHECK (unique_users_count >= 0),
  PRIMARY KEY (
    audience_kind, period_kind, period_start,
    service_category_id, partner_offer_id, plan_snapshot
  ),
  FOREIGN KEY(service_category_id) REFERENCES service_categories(id),
  FOREIGN KEY(partner_offer_id) REFERENCES partner_offers(id)
);

INSERT OR IGNORE INTO referral_unique_audience (
  audience_kind, period_kind, period_start, user_id,
  service_category_id, partner_offer_id, plan_snapshot, first_event_at
)
SELECT
  CASE event_type WHEN 'shown' THEN 'viewer' ELSE 'clicker' END,
  'day', CAST(created_at / 86400000 AS INTEGER) * 86400000, user_id,
  service_category_id, partner_offer_id, plan_snapshot, MIN(created_at)
FROM referral_events
WHERE event_type IN ('shown', 'clicked')
GROUP BY event_type, CAST(created_at / 86400000 AS INTEGER), user_id,
  service_category_id, partner_offer_id, plan_snapshot;

INSERT OR IGNORE INTO referral_unique_audience (
  audience_kind, period_kind, period_start, user_id,
  service_category_id, partner_offer_id, plan_snapshot, first_event_at
)
SELECT
  CASE event_type WHEN 'shown' THEN 'viewer' ELSE 'clicker' END,
  'month',
  CAST(strftime('%s', datetime(created_at / 1000, 'unixepoch'), 'start of month') AS INTEGER) * 1000,
  user_id, service_category_id, partner_offer_id, plan_snapshot, MIN(created_at)
FROM referral_events
WHERE event_type IN ('shown', 'clicked')
GROUP BY event_type,
  strftime('%Y-%m', datetime(created_at / 1000, 'unixepoch')), user_id,
  service_category_id, partner_offer_id, plan_snapshot;

INSERT INTO referral_audience_metrics (
  audience_kind, period_kind, period_start, service_category_id,
  partner_offer_id, plan_snapshot, unique_users_count
)
SELECT audience_kind, period_kind, period_start, service_category_id,
  partner_offer_id, plan_snapshot, COUNT(*)
FROM referral_unique_audience
GROUP BY audience_kind, period_kind, period_start, service_category_id,
  partner_offer_id, plan_snapshot;

CREATE INDEX idx_referral_unique_audience_period
  ON referral_unique_audience(period_kind, period_start, audience_kind);
CREATE INDEX idx_referral_audience_metrics_period
  ON referral_audience_metrics(period_kind, period_start, audience_kind);
