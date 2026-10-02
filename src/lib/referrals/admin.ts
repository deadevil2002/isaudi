import { getDb } from '@/lib/db/client';
import type { LandingFindingConfidence, LandingFindingSeverity } from '@/lib/landing-page/types';
import { hmacPseudonym } from '@/lib/admin/security';
import type { ReferralDb } from './repository';
import {
  boundedText,
  normalizePartnerUrl,
  parseCommissionBasis,
  parseCommission,
  parsePlatforms,
  parseQualityStatus,
  parseStatus,
} from './validation';

type AdminIdentity = { id: string; role: string };

export class ReferralAdminError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(reason);
    this.name = 'ReferralAdminError';
  }
}

function requireSuperAdmin(admin: AdminIdentity) {
  if (admin.role !== 'super_admin') throw new ReferralAdminError(403, 'forbidden');
}

function integer(value: unknown, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ReferralAdminError(400, 'invalid_number');
  }
  return parsed;
}

function confidence(value: unknown): LandingFindingConfidence {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new ReferralAdminError(400, 'invalid_confidence');
  }
  return value;
}

function severity(value: unknown): LandingFindingSeverity {
  if (value !== 'low' && value !== 'medium' && value !== 'high' && value !== 'critical') {
    throw new ReferralAdminError(400, 'invalid_severity');
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (value !== true && value !== false) throw new ReferralAdminError(400, 'invalid_boolean');
  return value;
}

function safeValidation<T>(callback: () => T): T {
  try {
    return callback();
  } catch (error) {
    if (error instanceof ReferralAdminError) throw error;
    throw new ReferralAdminError(400, error instanceof Error ? error.message : 'invalid_input');
  }
}

export async function saveServiceCategory(input: {
  admin: AdminIdentity;
  data: Record<string, unknown>;
  db?: ReferralDb;
  createId?: () => string;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const id = input.data.id
    ? safeValidation(() => boundedText(input.data.id, 128))
    : input.createId ? input.createId() : crypto.randomUUID();
  const slug = safeValidation(() => boundedText(input.data.slug, 80).toLowerCase());
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(slug)) throw new ReferralAdminError(400, 'invalid_slug');
  const now = (input.now ?? Date.now)();
  const values = {
    nameAr: safeValidation(() => boundedText(input.data.nameAr, 120)),
    nameEn: safeValidation(() => boundedText(input.data.nameEn, 120)),
    descriptionAr: safeValidation(() => boundedText(input.data.descriptionAr ?? '', 500, false)),
    descriptionEn: safeValidation(() => boundedText(input.data.descriptionEn ?? '', 500, false)),
    active: boolean(input.data.active),
    minimumConfidence: confidence(input.data.minimumConfidence),
    minimumSeverity: severity(input.data.minimumSeverity),
    maxReferrals: integer(input.data.maxReferralsPerAnalysis, 1, 5),
  };
  if (input.data.id) {
    if (!await db.prepare('SELECT id FROM service_categories WHERE id=?').get(id)) {
      throw new ReferralAdminError(404, 'category_not_found');
    }
    await db.prepare(`UPDATE service_categories SET
      slug=?, name_ar=?, name_en=?, description_ar=?, description_en=?, active=?,
      minimum_confidence=?, minimum_severity=?, max_referrals_per_analysis=?, updated_at=?
      WHERE id=?`).run(
      slug, values.nameAr, values.nameEn, values.descriptionAr, values.descriptionEn,
      values.active ? 1 : 0, values.minimumConfidence, values.minimumSeverity,
      values.maxReferrals, now, id
    );
  } else {
    await db.prepare(`INSERT INTO service_categories (
      id, slug, name_ar, name_en, description_ar, description_en, active,
      minimum_confidence, minimum_severity, max_referrals_per_analysis,
      created_by_admin_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, slug, values.nameAr, values.nameEn, values.descriptionAr, values.descriptionEn,
      values.active ? 1 : 0, values.minimumConfidence, values.minimumSeverity,
      values.maxReferrals, input.admin.id, now, now
    );
  }
  return { id, slug };
}

export async function savePartnerOffer(input: {
  admin: AdminIdentity;
  data: Record<string, unknown>;
  db?: ReferralDb;
  createId?: () => string;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const id = input.data.id
    ? safeValidation(() => boundedText(input.data.id, 128))
    : input.createId ? input.createId() : crypto.randomUUID();
  const commission = safeValidation(() => parseCommission(input.data));
  const commissionBasis = safeValidation(() => parseCommissionBasis(input.data.commissionBasis));
  const status = safeValidation(() => parseStatus(input.data.status));
  const qualityStatus = safeValidation(() => parseQualityStatus(input.data.qualityStatus));
  if (status === 'active' && qualityStatus !== 'approved') {
    throw new ReferralAdminError(400, 'active_offer_requires_approval');
  }
  const values = {
    serviceCategoryId: safeValidation(() => boundedText(input.data.serviceCategoryId, 128)),
    partnerName: safeValidation(() => boundedText(input.data.partnerName, 160)),
    partnerUrl: safeValidation(() => normalizePartnerUrl(input.data.partnerUrl)),
    serviceTitleAr: safeValidation(() => boundedText(input.data.serviceTitleAr, 180)),
    serviceTitleEn: safeValidation(() => boundedText(input.data.serviceTitleEn, 180)),
    descriptionAr: safeValidation(() => boundedText(input.data.descriptionAr ?? '', 700, false)),
    descriptionEn: safeValidation(() => boundedText(input.data.descriptionEn ?? '', 700, false)),
    supportedPlatforms: safeValidation(() => parsePlatforms(input.data.supportedPlatforms)),
    displayPriority: integer(input.data.displayPriority, 0, 10000),
  };
  const category = await db.prepare('SELECT id FROM service_categories WHERE id=?')
    .get(values.serviceCategoryId);
  if (!category) throw new ReferralAdminError(400, 'category_not_found');
  const now = (input.now ?? Date.now)();
  const params = [
    values.serviceCategoryId, values.partnerName, values.partnerUrl,
    values.serviceTitleAr, values.serviceTitleEn,
    values.descriptionAr, values.descriptionEn,
    JSON.stringify(values.supportedPlatforms), commission.commissionType,
    commission.commissionRateBps, commission.fixedAmountHalala,
    commission.commissionCurrency, commissionBasis, status, values.displayPriority,
    qualityStatus, now,
  ];
  if (input.data.id) {
    if (!await db.prepare('SELECT id FROM partner_offers WHERE id=?').get(id)) {
      throw new ReferralAdminError(404, 'offer_not_found');
    }
    await db.prepare(`UPDATE partner_offers SET
      service_category_id=?, partner_name=?, partner_url=?, service_title_ar=?,
      service_title_en=?, description_ar=?, description_en=?,
      supported_platforms_json=?, commission_type=?, commission_rate_bps=?,
      fixed_amount_halala=?, commission_currency=?, commission_basis=?, status=?, display_priority=?,
      quality_status=?, updated_at=? WHERE id=?`).run(...params, id);
  } else {
    await db.prepare(`INSERT INTO partner_offers (
      id, service_category_id, partner_name, partner_url, service_title_ar,
      service_title_en, description_ar, description_en, supported_platforms_json,
      commission_type, commission_rate_bps, fixed_amount_halala,
      commission_currency, commission_basis, status, display_priority, quality_status,
      created_by_admin_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ...params.slice(0, -1), input.admin.id, now, now);
  }
  return { id };
}

function startOfUtcDay(now: number): number {
  return Math.floor(now / 86_400_000) * 86_400_000;
}

function startOfUtcMonth(now: number): number {
  const value = new Date(now);
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1);
}

export function referralMetric(row: Record<string, unknown> | undefined) {
  const referrals = Number(row?.referrals ?? 0);
  const shown = Number(row?.shown ?? 0);
  const clicks = Number(row?.clicks ?? 0);
  const uniqueViewers = Number(row?.unique_viewers ?? 0);
  const uniqueClickers = Number(row?.unique_clickers ?? 0);
  return {
    referrals, shown, uniqueViewers, clicks, uniqueClickers,
    ctr: uniqueViewers > 0 ? uniqueClickers / uniqueViewers : 0,
  };
}

export async function readReferralAdminDashboard(input: {
  admin: AdminIdentity;
  db?: ReferralDb;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const now = (input.now ?? Date.now)();
  const today = startOfUtcDay(now);
  const month = startOfUtcMonth(now);
  const [categories, offers, todayMetrics, monthMetrics, breakdown, referrals, clicks,
    conversions, conversionMetrics, commissionMetrics, conversionBreakdown] = await Promise.all([
    db.prepare(`SELECT id, slug, name_ar, name_en, description_ar, description_en,
      active, minimum_confidence, minimum_severity, max_referrals_per_analysis,
      created_at, updated_at FROM service_categories ORDER BY created_at ASC LIMIT 100`).all(),
    db.prepare(`SELECT o.id, o.service_category_id, c.slug AS category_slug,
      o.partner_name, o.partner_url, o.service_title_ar, o.service_title_en,
      o.description_ar, o.description_en, o.supported_platforms_json,
      o.commission_type, o.commission_rate_bps, o.fixed_amount_halala,
      o.commission_currency, o.commission_basis, o.status, o.display_priority, o.quality_status,
      o.created_at, o.updated_at FROM partner_offers o
      JOIN service_categories c ON c.id=o.service_category_id
      ORDER BY o.display_priority ASC, o.created_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT SUM(referrals_count) referrals, SUM(shown_count) shown,
      SUM(clicks_count) clicks,
      COALESCE((SELECT SUM(unique_users_count) FROM referral_audience_metrics
        WHERE audience_kind='viewer' AND period_kind='day' AND period_start=?), 0)
        unique_viewers,
      COALESCE((SELECT SUM(unique_users_count) FROM referral_audience_metrics
        WHERE audience_kind='clicker' AND period_kind='day' AND period_start=?), 0)
        unique_clickers
      FROM referral_daily_metrics WHERE day_start>=?`).get(today, today, today),
    db.prepare(`SELECT SUM(referrals_count) referrals, SUM(shown_count) shown,
      SUM(clicks_count) clicks,
      COALESCE((SELECT SUM(unique_users_count) FROM referral_audience_metrics
        WHERE audience_kind='viewer' AND period_kind='month' AND period_start=?), 0)
        unique_viewers,
      COALESCE((SELECT SUM(unique_users_count) FROM referral_audience_metrics
        WHERE audience_kind='clicker' AND period_kind='month' AND period_start=?), 0)
        unique_clickers
      FROM referral_daily_metrics WHERE day_start>=?`).get(month, month, month),
    db.prepare(`SELECT m.service_category_id, c.slug AS category_slug,
      m.partner_offer_id, o.partner_name, m.plan_snapshot,
      SUM(m.referrals_count) referrals, SUM(m.shown_count) shown,
      SUM(m.clicks_count) clicks,
      COALESCE(MAX(viewers.unique_users_count), 0) unique_viewers,
      COALESCE(MAX(clickers.unique_users_count), 0) unique_clickers
      FROM referral_daily_metrics m
      JOIN service_categories c ON c.id=m.service_category_id
      JOIN partner_offers o ON o.id=m.partner_offer_id
      LEFT JOIN referral_audience_metrics viewers
        ON viewers.audience_kind='viewer' AND viewers.period_kind='month'
        AND viewers.period_start=?
        AND viewers.service_category_id=m.service_category_id
        AND viewers.partner_offer_id=m.partner_offer_id
        AND viewers.plan_snapshot=m.plan_snapshot
      LEFT JOIN referral_audience_metrics clickers
        ON clickers.audience_kind='clicker' AND clickers.period_kind='month'
        AND clickers.period_start=?
        AND clickers.service_category_id=m.service_category_id
        AND clickers.partner_offer_id=m.partner_offer_id
        AND clickers.plan_snapshot=m.plan_snapshot
      WHERE m.day_start>=? GROUP BY m.service_category_id, m.partner_offer_id, m.plan_snapshot
      ORDER BY clicks DESC, shown DESC LIMIT 100`).all(month, month, month),
    db.prepare(`SELECT r.id, r.analysis_id, r.finding_code, r.status, r.source,
      r.plan_snapshot, r.created_at, c.slug AS category_slug, o.partner_name,
      r.user_id FROM service_referrals r
      JOIN service_categories c ON c.id=r.service_category_id
      JOIN partner_offers o ON o.id=r.partner_offer_id
      ORDER BY r.created_at DESC LIMIT 25`).all(),
    db.prepare(`SELECT e.id, e.referral_id, e.event_type, e.finding_code,
      e.plan_snapshot, e.created_at, c.slug AS category_slug, o.partner_name,
      e.user_id FROM referral_events e
      JOIN service_categories c ON c.id=e.service_category_id
      JOIN partner_offers o ON o.id=e.partner_offer_id
      ORDER BY e.created_at DESC LIMIT 25`).all(),
    db.prepare(`SELECT x.id, x.referral_id, x.status, x.source, x.external_reference,
      x.converted_at, x.submitted_at, x.verified_at, x.amount_halala, x.currency,
      x.plan_snapshot, x.created_at, x.user_id, c.slug AS category_slug,
      o.partner_name, o.commission_basis,
      cm.status AS commission_status, cm.commission_amount_halala
      FROM referral_conversions x
      JOIN service_categories c ON c.id=x.service_category_id
      JOIN partner_offers o ON o.id=x.partner_offer_id
      LEFT JOIN referral_commissions cm ON cm.conversion_id=x.id
      ORDER BY x.created_at DESC LIMIT 50`).all(),
    db.prepare(`SELECT SUM(conversions_count) total,
      SUM(pending_count) pending, SUM(verified_count) verified,
      SUM(rejected_count) rejected, SUM(cancelled_count) cancelled
      FROM referral_conversion_daily_metrics WHERE day_start>=?`).get(month),
    db.prepare(`SELECT currency, SUM(earned_halala) earned_halala,
      SUM(approved_halala) approved_halala, SUM(paid_halala) paid_halala
      FROM referral_commission_daily_metrics WHERE day_start>=?
      GROUP BY currency ORDER BY currency ASC LIMIT 20`).all(month),
    db.prepare(`SELECT m.service_category_id, c.slug AS category_slug,
      m.partner_offer_id, o.partner_name, m.plan_snapshot, m.merchant_id,
      SUM(m.conversions_count) total, SUM(m.pending_count) pending,
      SUM(m.verified_count) verified, SUM(m.rejected_count) rejected,
      SUM(m.cancelled_count) cancelled
      FROM referral_conversion_daily_metrics m
      JOIN service_categories c ON c.id=m.service_category_id
      JOIN partner_offers o ON o.id=m.partner_offer_id
      WHERE m.day_start>=?
      GROUP BY m.service_category_id, m.partner_offer_id, m.plan_snapshot, m.merchant_id
      ORDER BY verified DESC, total DESC LIMIT 100`).all(month),
  ]);
  const pseudonymize = async (rows: Record<string, unknown>[]) => Promise.all(rows.map(async (row) => {
    const { user_id, ...publicRow } = row;
    return {
      ...publicRow,
      customer_identifier: `cust_${(await hmacPseudonym(`referral:${String(user_id)}`)).slice(0, 12)}`,
    };
  }));
  return {
    metrics: { today: referralMetric(todayMetrics), month: referralMetric(monthMetrics) },
    breakdown: breakdown.map((row) => ({ ...row, ...referralMetric(row) })),
    categories,
    offers,
    referrals: await pseudonymize(referrals),
    clicks: await pseudonymize(clicks),
    conversions: await pseudonymize(conversions),
    conversionBreakdown: await Promise.all(conversionBreakdown.map(async (row) => {
      const { merchant_id, ...publicRow } = row;
      return {
        ...publicRow,
        store_identifier: `store_${(await hmacPseudonym(`merchant:${String(merchant_id)}`)).slice(0, 12)}`,
      };
    })),
    attributionWindow: null,
    commissions: {
      totalConversions: Number(conversionMetrics?.total ?? 0),
      pendingConversions: Number(conversionMetrics?.pending ?? 0),
      verifiedConversions: Number(conversionMetrics?.verified ?? 0),
      rejectedConversions: Number(conversionMetrics?.rejected ?? 0),
      cancelledConversions: Number(conversionMetrics?.cancelled ?? 0),
      byCurrency: commissionMetrics.map((row) => ({
        currency: String(row.currency),
        earnedHalala: Number(row.earned_halala ?? 0),
        approvedHalala: Number(row.approved_halala ?? 0),
        paidHalala: Number(row.paid_halala ?? 0),
      })),
    },
  };
}
